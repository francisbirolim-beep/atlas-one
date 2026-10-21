-- PROPOSTA NÃO APLICADA: depende de lembretes_inteligentes_tarefas_agenda_v1.sql
-- Criar tarefa de envio uma única vez quando orçamento entrar na coluna
-- "Orçamento feito", com responsável = vendedor que pediu o orçamento.
-- Se já houver automação ativa para o solicitante nessa mesma coluna,
-- deixar que a automação antiga continue responsável (não duplicar).
alter table public.tarefas
  add column if not exists origem_orcamento_id uuid references public.orcamentos(id) on delete set null;

create unique index if not exists tarefas_envio_orcamento_dedupe_v1
  on public.tarefas(usuario_id,origem_orcamento_id)
  where origem_orcamento_id is not null;

create or replace function public.fn_atlas_tarefa_orcamento_pronto_v1()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_coluna_id uuid;
  v_coluna_nome text;
  v_usuario_nome text;
  v_tarefa_id uuid;
  v_cliente text;
begin
  if new.coluna_id is null
    or new.coluna_id is not distinct from old.coluna_id
    or new.criado_por_id is null
    or new.empresa_id is null then
    return new;
  end if;

  select kc.nome into v_coluna_nome
  from public.kanban_colunas kc
  where kc.id = new.coluna_id
    and kc.empresa_id = new.empresa_id;
  if translate(lower(trim(coalesce(v_coluna_nome,''))), 'áàãâéêíóôõúç', 'aaaaeeiooouc')
     <> 'orcamento feito' then
    return new;
  end if;

  -- Compatibilidade: prioridade para automações do Kanban já configuradas.
  if exists (
    select 1 from public.automacoes_orcamento a
    where a.empresa_id = new.empresa_id
      and a.coluna_id = new.coluna_id
      and a.ativo
      and a.destino_tipo = 'solicitante'
  ) then return new; end if;

  select u.nome into v_usuario_nome
    from public.usuarios u
   where u.id = new.criado_por_id and u.empresa_id = new.empresa_id;
  if v_usuario_nome is null then return new; end if;

  select tc.id into v_coluna_id
    from public.tarefa_colunas tc
   where tc.usuario_id = new.criado_por_id
     and tc.empresa_id = new.empresa_id
   order by tc.ordem limit 1;

  if v_coluna_id is null then
    insert into public.tarefa_colunas (usuario_id,empresa_id,nome,ordem)
    values (new.criado_por_id,new.empresa_id,'A fazer',0)
    returning id into v_coluna_id;
  end if;

  v_cliente := coalesce(nullif(trim(new.cliente_nome),''),'cliente');
  insert into public.tarefas (
    empresa_id,usuario_id,coluna_id,titulo,descricao,data_hora,
    prioridade,origem_orcamento_id
  ) values (
    new.empresa_id,new.criado_por_id,v_coluna_id,
    'Enviar orçamento para ' || v_cliente,
    'Orçamento ' || coalesce('#' || new.numero::text,'') || ' pronto. Confirmar envio ao cliente.',
    now(),'normal',new.id
  )
  on conflict (usuario_id,origem_orcamento_id)
    where origem_orcamento_id is not null do nothing
  returning id into v_tarefa_id;

  if v_tarefa_id is not null then
    insert into public.notificacoes (
      empresa_id,usuario_id,categoria,tipo,titulo,mensagem,href,
      origem_tipo,origem_id
    ) values (
      new.empresa_id,new.criado_por_id,'tarefas','orcamento_pronto_envio',
      'Orçamento pronto: ' || v_cliente,
      'Falta enviar ao cliente. Toque para concluir, adiar ou reagendar.',
      '/tarefas','orcamento_pronto_envio',new.id::text
    ) on conflict (usuario_id,origem_tipo,origem_id)
      where origem_tipo is not null and origem_id is not null do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.fn_atlas_tarefa_orcamento_pronto_v1()
  from public, anon, authenticated;
drop trigger if exists trg_atlas_tarefa_orcamento_pronto_v1 on public.orcamentos;
create trigger trg_atlas_tarefa_orcamento_pronto_v1
after update of coluna_id on public.orcamentos
for each row
execute function public.fn_atlas_tarefa_orcamento_pronto_v1();
