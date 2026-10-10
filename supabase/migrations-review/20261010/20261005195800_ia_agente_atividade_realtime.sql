create table if not exists public.ia_agente_atividade (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  usuario_id uuid,
  usuario_nome text,
  agente_id text not null,
  agente_nome text not null,
  contexto text,
  tarefa text,
  status text not null default 'processando'
    check (status in ('processando','concluido','erro')),
  iniciou_em timestamptz not null default now(),
  atualizou_em timestamptz not null default now(),
  finalizou_em timestamptz,
  detalhe jsonb not null default '{}'::jsonb
);

create index if not exists ia_agente_atividade_empresa_idx
  on public.ia_agente_atividade (empresa_id, atualizou_em desc);
create index if not exists ia_agente_atividade_agente_idx
  on public.ia_agente_atividade (empresa_id, agente_id, atualizou_em desc);

alter table public.ia_agente_atividade enable row level security;

drop policy if exists ia_agente_atividade_select on public.ia_agente_atividade;
create policy ia_agente_atividade_select on public.ia_agente_atividade
for select to authenticated using (empresa_id = private.current_empresa_id());

comment on table public.ia_agente_atividade is
'Heartbeat operacional dos agentes IA para a Central de Supervisão animada.';