create table if not exists public.wvetro_base_tecnica_pendencias (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references public.wvetro_base_tecnica_execucoes(id) on delete cascade,
  data date not null,
  erro text not null,
  tentativas integer not null default 1,
  status text not null default 'pendente' check (status in ('pendente','resolvida')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  resolvido_em timestamptz null,
  resultado jsonb null,
  unique (execucao_id, data)
);

alter table public.wvetro_base_tecnica_pendencias enable row level security;

alter table public.wvetro_base_tecnica_execucoes
  add column if not exists dias_pendentes integer not null default 0;

create index if not exists idx_wvetro_base_tecnica_pendencias_execucao_status
  on public.wvetro_base_tecnica_pendencias (execucao_id, status, data);
