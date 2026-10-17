-- PROPOSTA NÃO APLICADA: migrar somente depois de snapshot, validação da RLS
-- e ativação isolada do worker em homologação.
-- Nunca ativar cron/WhatsApp sem confirmar a integração da produção.
--
-- A implantação deve gerar uma migration canônica usando a Supabase CLI.
-- Este SQL é a minuta revisável na PR.

alter table public.notificacao_preferencias
  add column if not exists avisos_tarefa_minutos integer[] not null default array[1440,60,10],
  add column if not exists avisos_agenda_minutos integer[] not null default array[1440,60,30],
  add column if not exists cobranca_tarefa_ativa boolean not null default true,
  add column if not exists cobranca_tarefa_intervalo_minutos integer not null default 60,
  add column if not exists whatsapp_lembretes_ativo boolean not null default false;

alter table public.tarefas
  add column if not exists lembrete_minutos integer[],
  add column if not exists cobranca_intervalo_minutos integer,
  add column if not exists audio_url text,
  add column if not exists audio_transcricao text,
  add column if not exists lembretes_ativados_em timestamptz,
  add column if not exists origem_orcamento_id uuid references public.orcamentos(id) on delete set null;

alter table public.eventos
  add column if not exists lembrete_minutos integer[],
  add column if not exists audio_url text,
  add column if not exists audio_transcricao text,
  add column if not exists lembretes_ativados_em timestamptz;

-- Ativação só para novas tarefas/eventos ou mudança de horário;
-- sem disparo em massa de lembretes sobre legado antigo.
create or replace function public.fn_atlas_ativar_lembretes_tarefa_v1()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.data_hora is not null then new.lembretes_ativados_em := now(); end if;
  elsif new.data_hora is distinct from old.data_hora then
    new.lembretes_ativados_em := case when new.data_hora is not null then now() else null end;
  end if;
  return new;
end;
$$;
revoke all on function public.fn_atlas_ativar_lembretes_tarefa_v1() from public, anon, authenticated;
drop trigger if exists trg_atlas_ativar_lembretes_tarefa_v1 on public.tarefas;
create trigger trg_atlas_ativar_lembretes_tarefa_v1
before insert or update of data_hora on public.tarefas
for each row execute function public.fn_atlas_ativar_lembretes_tarefa_v1();

create or replace function public.fn_atlas_ativar_lembretes_agenda_v1()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    if new.data_inicio is not null then new.lembretes_ativados_em := now(); end if;
  elsif new.data_inicio is distinct from old.data_inicio then
    new.lembretes_ativados_em := case when new.data_inicio is not null then now() else null end;
  end if;
  return new;
end;
$$;
revoke all on function public.fn_atlas_ativar_lembretes_agenda_v1() from public, anon, authenticated;
drop trigger if exists trg_atlas_ativar_lembretes_agenda_v1 on public.eventos;
create trigger trg_atlas_ativar_lembretes_agenda_v1
before insert or update of data_inicio on public.eventos
for each row execute function public.fn_atlas_ativar_lembretes_agenda_v1();

-- Serviço transacional. Deve ser chamado exclusivamente por job autenticado do DB.
-- A chave (usuario_id, origem_tipo, origem_id) de notificacoes impede duplicatas
-- quando duas execuções do worker coincidirem ou quando houver retries.
create or replace function public.fn_atlas_processar_lembretes_v1()
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  -- Tarefas: avisos em horários individuais anteriores ao vencimento.
  insert into public.notificacoes (
    usuario_id,categoria,tipo,titulo,mensagem,href,origem_tipo,origem_id
  )
  select t.usuario_id,'tarefas','lembrete_tarefa',
    'Tarefa: ' || t.titulo,
    'Prazo: ' || to_char(t.data_hora at time zone coalesce(p.timezone,'America/Sao_Paulo'), 'DD/MM HH24:MI'),
    '/tarefas','lembrete_tarefa',t.id::text || ':antes:' || a.minutos::text
  from public.tarefas t
  left join public.notificacao_preferencias p on p.usuario_id = t.usuario_id
  cross join lateral unnest(
    coalesce(t.lembrete_minutos,p.avisos_tarefa_minutos,array[1440,60,10]::integer[])
  ) a(minutos)
  where t.lembretes_ativados_em is not null
    and t.concluida_em is null
    and t.data_hora is not null
    and t.data_hora > now()
    and coalesce(p.tarefas,true)
    and a.minutos between 1 and 43200
    and t.data_hora - a.minutos * interval '1 minute' <= now()
    and t.data_hora - a.minutos * interval '1 minute' > now() - interval '15 minutes'
  on conflict (usuario_id,origem_tipo,origem_id)
    where origem_tipo is not null and origem_id is not null do nothing;

  -- Agenda: evento próprio + convidados que aceitaram, nunca duplicar organizador.
  insert into public.notificacoes (
    usuario_id,categoria,tipo,titulo,mensagem,href,origem_tipo,origem_id
  )
  select destinos.usuario_id,'agenda','lembrete_agenda',
    'Compromisso: ' || e.titulo,
    'Início: ' || to_char(e.data_inicio at time zone coalesce(p.timezone,'America/Sao_Paulo'), 'DD/MM HH24:MI'),
    '/','lembrete_agenda',
    e.id::text || ':antes:' || a.minutos::text
  from public.eventos e
  join lateral (
    select e.usuario_id as usuario_id
    union
    select ec.usuario_id from public.evento_convidados ec
      where ec.evento_id = e.id and ec.status = 'aceito'
  ) destinos on true
  left join public.notificacao_preferencias p on p.usuario_id = destinos.usuario_id
  cross join lateral unnest(
    coalesce(e.lembrete_minutos,p.avisos_agenda_minutos,array[1440,60,30]::integer[])
  ) a(minutos)
  where e.lembretes_ativados_em is not null
    and e.data_inicio > now()
    and coalesce(p.agenda,true)
    and a.minutos between 1 and 43200
    and e.data_inicio - a.minutos * interval '1 minute' <= now()
    and e.data_inicio - a.minutos * interval '1 minute' > now() - interval '15 minutes'
  on conflict (usuario_id,origem_tipo,origem_id)
    where origem_tipo is not null and origem_id is not null do nothing;

  -- Pendências: só o ciclo corrente, sem replay dos ciclos anteriores.
  -- Ex.: prazo 9h, intervalo 60 min => 10h ciclo 1, 11h ciclo 2 etc.
  insert into public.notificacoes (
    usuario_id,categoria,tipo,titulo,mensagem,href,origem_tipo,origem_id
  )
  select t.usuario_id,'tarefas','cobranca_tarefa',
    'Tarefa ainda em aberto: ' || t.titulo,
    'Você concluiu? Responda pela tarefa ou reagende o prazo no Atlas.',
    '/tarefas','cobranca_tarefa',t.id::text || ':ciclo:' || ciclo.numero::text
  from public.tarefas t
  left join public.notificacao_preferencias p on p.usuario_id = t.usuario_id
  cross join lateral (
    select greatest(15, least(1440,
      coalesce(t.cobranca_intervalo_minutos,p.cobranca_tarefa_intervalo_minutos,60)
    ))::integer as minutos
  ) intervalo
  cross join lateral (
    select floor(extract(epoch from (now() - t.data_hora)) / (intervalo.minutos*60))::integer as numero
  ) ciclo
  where t.lembretes_ativados_em is not null
    and t.concluida_em is null
    and t.data_hora is not null
    and coalesce(p.tarefas,true)
    and coalesce(p.cobranca_tarefa_ativa,true)
    and ciclo.numero >= 1
    and now() < t.data_hora + (ciclo.numero*intervalo.minutos + 15) * interval '1 minute'
    and t.data_hora > now() - interval '30 days'
  on conflict (usuario_id,origem_tipo,origem_id)
    where origem_tipo is not null and origem_id is not null do nothing;
end;
$$;
revoke all on function public.fn_atlas_processar_lembretes_v1() from public, anon, authenticated;

-- A instalação do job por minuto será uma etapa operacional separada
-- e verificável. Não agendar automaticamente ao rodar esta minuta.
-- Verificar pg_cron e, após aprovação:
-- select cron.schedule('atlas-lembretes-v1','* * * * *',
--   'select public.fn_atlas_processar_lembretes_v1()');
