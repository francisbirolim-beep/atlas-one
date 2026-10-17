-- Base aditiva para avisos inteligentes. Somente aplicar após homologação em prévia.
-- Nenhuma rotina ou configuração antiga é substituída.
alter table public.notificacao_preferencias
  add column if not exists tarefas_avisos_minutos integer[] not null default array[1440,60],
  add column if not exists agenda_avisos_minutos integer[] not null default array[1440,60,10],
  add column if not exists tarefas_repetir_pendente_minutos integer not null default 60,
  add column if not exists agenda_repetir_pendente_minutos integer not null default 0,
  add column if not exists lembretes_whatsapp_ativo boolean not null default false;

alter table public.tarefas
  add column if not exists avisos_minutos integer[] default null,
  add column if not exists repetir_pendente_minutos integer default null,
  add column if not exists pausado_ate timestamptz default null,
  add column if not exists origem_lembrete text default null,
  add column if not exists lembretes_inicio_em timestamptz default null;

alter table public.eventos
  add column if not exists avisos_minutos integer[] default null,
  add column if not exists repetir_pendente_minutos integer default null,
  add column if not exists pausado_ate timestamptz default null,
  add column if not exists concluido_em timestamptz default null,
  add column if not exists lembretes_inicio_em timestamptz default null;

-- Evita disparos retroativos em massa para o legado no primeiro deploy.
create or replace function private.ativar_lembretes_novo_atlas()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  if new.lembretes_inicio_em is null then new.lembretes_inicio_em := now(); end if;
  return new;
end; $fn$;
drop trigger if exists trg_ativar_lembretes_tarefa_atlas on public.tarefas;
create trigger trg_ativar_lembretes_tarefa_atlas
  before insert or update of data_hora,avisos_minutos,repetir_pendente_minutos on public.tarefas
  for each row execute function private.ativar_lembretes_novo_atlas();
drop trigger if exists trg_ativar_lembretes_evento_atlas on public.eventos;
create trigger trg_ativar_lembretes_evento_atlas
  before insert or update of data_inicio,avisos_minutos,repetir_pendente_minutos on public.eventos
  for each row execute function private.ativar_lembretes_novo_atlas();

-- Áudios originais de tarefas/compromissos, sempre privados e vinculados após confirmação.
create table if not exists public.lembretes_audios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  usuario_id uuid not null references public.usuarios(id),
  tipo text not null check (tipo in ('tarefa','agenda')),
  referencia_id uuid,
  arquivo_path text not null unique,
  mime_type text not null,
  tamanho_bytes integer not null check (tamanho_bytes > 0 and tamanho_bytes <= 12582912),
  transcricao text,
  created_at timestamptz not null default now()
);
create index if not exists lembretes_audios_usuario_ref_idx
  on public.lembretes_audios(empresa_id, usuario_id, referencia_id);
alter table public.lembretes_audios enable row level security;
revoke all on table public.lembretes_audios from public,anon,authenticated;
grant select,insert,update,delete on table public.lembretes_audios to service_role;

create unique index if not exists tarefas_orcamento_envio_unico
  on public.tarefas(empresa_id, orcamento_id, usuario_id)
  where origem_lembrete = 'orcamento_feito_envio' and orcamento_id is not null;

-- Alterações individuais respeitam as mesmas permissões e RLS já vigentes nas tabelas.
-- A configuração padrao é lida quando o campo da tarefa/evento está nulo;
-- array vazio desativa avisos dessa tarefa especificamente.
create or replace function private.processar_lembretes_atlas()
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v record;
  v_agora timestamptz := now();
  v_min integer;
  v_antecedencias integer[];
  v_repeticao integer;
  v_hora timestamptz;
  v_intervalos bigint;
  v_chave text;
  v_mensagem text;
  v_total integer := 0;
begin
  for v in
    select t.id, t.empresa_id, t.usuario_id, t.titulo, t.data_hora as referencia,
           'tarefas'::text as categoria, t.avisos_minutos as avisos,
           t.repetir_pendente_minutos as repeticao,
           p.tarefas_avisos_minutos as padrao_avisos,
           p.tarefas_repetir_pendente_minutos as padrao_repeticao,
           p.tarefas as categoria_ativa, p.nao_perturbe_ativo, p.nao_perturbe_inicio,
           p.nao_perturbe_fim, p.timezone
      from public.tarefas t
      left join public.notificacao_preferencias p
        on p.usuario_id = t.usuario_id and p.empresa_id = t.empresa_id
     where t.concluida_em is null
       and t.data_hora is not null
       and t.lembretes_inicio_em is not null
       and t.data_hora between v_agora - interval '30 days' and v_agora + interval '31 days'
       and (t.pausado_ate is null or t.pausado_ate <= v_agora)
    union all
    select e.id, e.empresa_id, e.usuario_id, e.titulo, e.data_inicio as referencia,
           'agenda'::text as categoria, e.avisos_minutos as avisos,
           e.repetir_pendente_minutos as repeticao,
           p.agenda_avisos_minutos as padrao_avisos,
           p.agenda_repetir_pendente_minutos as padrao_repeticao,
           p.agenda as categoria_ativa, p.nao_perturbe_ativo, p.nao_perturbe_inicio,
           p.nao_perturbe_fim, p.timezone
      from public.eventos e
      left join public.notificacao_preferencias p
        on p.usuario_id = e.usuario_id and p.empresa_id = e.empresa_id
     where e.concluido_em is null
       and e.lembretes_inicio_em is not null
       and e.data_inicio between v_agora - interval '30 days' and v_agora + interval '31 days'
       and (e.pausado_ate is null or e.pausado_ate <= v_agora)
  loop
    if v.categoria_ativa is false then continue; end if;
    -- O modo 'Não perturbe' existente continua controlando o som no canal de entrega.
    v_antecedencias := coalesce(v.avisos, v.padrao_avisos,
      case when v.categoria = 'agenda' then array[1440,60,10] else array[1440,60] end);
    foreach v_min in array v_antecedencias loop
      if v_min < 0 or v_min > 43200 then continue; end if;
      v_hora := v.referencia - make_interval(mins => v_min);
      if v_hora > v_agora or v_hora <= v_agora - interval '10 minutes' then continue; end if;
      v_chave := v.id::text || ':' || v.referencia::text || ':antes:' || v_min::text;
      v_mensagem := case when v_min >= 1440 then (v_min / 1440)::text || ' dia(s) antes'
                         when v_min >= 60 then (v_min / 60)::text || ' hora(s) antes'
                         else v_min::text || ' minuto(s) antes' end;
      insert into public.notificacoes(
        empresa_id, usuario_id, categoria, tipo, titulo, mensagem, href, origem_tipo, origem_id)
      values(v.empresa_id, v.usuario_id, v.categoria, 'lembrete_programado',
             'Lembrete: ' || left(v.titulo,130),
             v_mensagem || ' — confira seu ' ||
               case when v.categoria = 'agenda' then 'compromisso.' else 'prazo da tarefa.' end,
             case when v.categoria = 'agenda' then '/' else '/tarefas' end,
             'lembrete_programado', v_chave)
      on conflict (usuario_id,origem_tipo,origem_id)
        where origem_tipo is not null and origem_id is not null do nothing;
      if found then v_total := v_total + 1; end if;
    end loop;

    v_repeticao := coalesce(v.repeticao, v.padrao_repeticao,
      case when v.categoria = 'agenda' then 0 else 60 end);
    if v_repeticao not in (0,15,30,60,120,180,360,720,1440) then continue; end if;
    if v_repeticao = 0 or v.referencia >= v_agora then continue; end if;
    v_intervalos := floor(extract(epoch from (v_agora - v.referencia)) / (60 * v_repeticao));
    if v_intervalos < 1 then continue; end if;
    v_chave := v.id::text || ':' || v.referencia::text || ':pendente:' || v_intervalos::text;
    insert into public.notificacoes(
      empresa_id,usuario_id,categoria,tipo,titulo,mensagem,href,origem_tipo,origem_id)
    values(v.empresa_id,v.usuario_id,v.categoria,'lembrete_pendente',
           'Ainda pendente: ' || left(v.titulo,130),
           'Você já concluiu? Abra no Atlas para concluir, adiar ou reagendar.',
           case when v.categoria = 'agenda' then '/' else '/tarefas' end,
           'lembrete_pendente',v_chave)
    on conflict (usuario_id,origem_tipo,origem_id)
      where origem_tipo is not null and origem_id is not null do nothing;
    if found then v_total := v_total + 1; end if;
  end loop;
  return v_total;
end;
$fn$;
revoke all on function private.processar_lembretes_atlas() from public, anon, authenticated;
grant execute on function private.processar_lembretes_atlas() to service_role;

-- Evita notificações aguardando entrega quando uma tarefa já mudou de estado.
create or replace function private.cancelar_avisos_desatualizados_atlas()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  if tg_table_name = 'tarefas' then
    if new.concluida_em is not distinct from old.concluida_em
       and new.data_hora is not distinct from old.data_hora
       and new.pausado_ate is not distinct from old.pausado_ate then return new; end if;
  else
    if new.concluido_em is not distinct from old.concluido_em
       and new.data_inicio is not distinct from old.data_inicio
       and new.pausado_ate is not distinct from old.pausado_ate then return new; end if;
  end if;
  update public.notificacoes set push_status = 'ignorado'
  where empresa_id = new.empresa_id and usuario_id = new.usuario_id
    and origem_tipo in ('lembrete_programado','lembrete_pendente')
    and left(origem_id,length(new.id::text)+1) = new.id::text||':'
    and push_status='pendente';
  return new;
end;
$fn$;
revoke all on function private.cancelar_avisos_desatualizados_atlas() from public,anon,authenticated;
drop trigger if exists trg_cancelar_avisos_tarefa_atlas on public.tarefas;
create trigger trg_cancelar_avisos_tarefa_atlas
  after update of concluida_em,data_hora,pausado_ate on public.tarefas
  for each row execute function private.cancelar_avisos_desatualizados_atlas();
drop trigger if exists trg_cancelar_avisos_evento_atlas on public.eventos;
create trigger trg_cancelar_avisos_evento_atlas
  after update of concluido_em,data_inicio,pausado_ate on public.eventos
  for each row execute function private.cancelar_avisos_desatualizados_atlas();

-- Orçamento muda para Feito: tarefa única ao solicitante, sem interferir no Kanban existente.
create or replace function private.criar_tarefa_envio_orcamento_atlas()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
declare
  v_nome text;
  v_coluna uuid;
  v_tarefa uuid;
begin
  if new.coluna_id is not distinct from old.coluna_id then return new; end if;
  select lower(trim(nome)) into v_nome
    from public.kanban_colunas
   where id = new.coluna_id and empresa_id = new.empresa_id;
  if v_nome in ('enviado ao cliente','enviado para o cliente') then
    update public.tarefas set concluida_em = coalesce(concluida_em,now())
     where empresa_id = new.empresa_id and orcamento_id = new.id
       and origem_lembrete = 'orcamento_feito_envio' and concluida_em is null;
  elsif v_nome in ('orçamento feito','orcamento feito') and new.criado_por_id is not null then
    select id into v_coluna
      from public.tarefa_colunas
     where usuario_id = new.criado_por_id and empresa_id = new.empresa_id
     order by ordem limit 1;
    if v_coluna is null then
      insert into public.tarefa_colunas(empresa_id,usuario_id,nome,ordem)
      values(new.empresa_id,new.criado_por_id,'A fazer',0)
      returning id into v_coluna;
    end if;
    insert into public.tarefas(
      empresa_id,usuario_id,coluna_id,titulo,descricao,data_hora,
      cliente_id,obra_id,orcamento_id,origem_lembrete)
    values(new.empresa_id,new.criado_por_id,v_coluna,
      'Enviar orçamento — ' || coalesce(nullif(new.cliente_nome,''),'cliente'),
      'Orçamento #' || coalesce(new.numero::text,'sem número') ||
      ' está pronto. Envie a proposta ao cliente e confirme o envio.',
      now() + interval '1 hour',
      new.cliente_id,new.obra_id,new.id,'orcamento_feito_envio')
    on conflict (empresa_id,orcamento_id,usuario_id)
      where origem_lembrete = 'orcamento_feito_envio' and orcamento_id is not null
      do nothing returning id into v_tarefa;
    if v_tarefa is not null then
      insert into public.notificacoes(
        empresa_id, usuario_id, categoria, tipo, titulo, mensagem, href, origem_tipo, origem_id)
      values(new.empresa_id,new.criado_por_id,'tarefas','orcamento_pronto_envio',
        'Orçamento pronto: ' || coalesce(nullif(new.cliente_nome,''),'cliente'),
        'O orçamento está pronto. Falta enviar ao cliente.',
        '/tarefas','orcamento_pronto_envio',v_tarefa::text)
      on conflict (usuario_id,origem_tipo,origem_id)
        where origem_tipo is not null and origem_id is not null do nothing;
    end if;
  end if;
  return new;
end;
$fn$;
revoke all on function private.criar_tarefa_envio_orcamento_atlas() from public,anon,authenticated;
drop trigger if exists trg_criar_tarefa_envio_orcamento_atlas on public.orcamentos;
create trigger trg_criar_tarefa_envio_orcamento_atlas
  after update of coluna_id on public.orcamentos
  for each row execute function private.criar_tarefa_envio_orcamento_atlas();

-- Agenda do pg_cron: só entra em operação após publicação/homologação desta migração.
select cron.schedule(
  'atlas-lembretes-inteligentes-minuto',
  '* * * * *',
  'select private.processar_lembretes_atlas();'
);
