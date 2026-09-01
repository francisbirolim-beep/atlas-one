create table if not exists public.wvetro_base_tecnica_execucoes (
  id uuid primary key default gen_random_uuid(),
  periodo_inicio date not null,
  periodo_fim date not null,
  cursor_data date not null,
  status text not null default 'em_andamento' check (status in ('em_andamento','concluida','erro','cancelada')),
  dias_processados integer not null default 0,
  itens_processados integer not null default 0,
  tipologias_processadas integer not null default 0,
  componentes_processados integer not null default 0,
  ultima_mensagem text null,
  erro text null,
  criado_por_id uuid null,
  criado_por_nome text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalizado_em timestamptz null,
  constraint wvetro_base_tecnica_periodo_valido check (periodo_fim >= periodo_inicio)
);

create index if not exists idx_wvetro_base_tecnica_execucoes_status
  on public.wvetro_base_tecnica_execucoes(status, updated_at desc);

alter table public.wvetro_base_tecnica_execucoes enable row level security;
revoke all on public.wvetro_base_tecnica_execucoes from anon, authenticated;

comment on table public.wvetro_base_tecnica_execucoes is
  'Checkpoint resumível da carga histórica W.Vetro por dia para montar BOM, custos e referências técnicas.';
