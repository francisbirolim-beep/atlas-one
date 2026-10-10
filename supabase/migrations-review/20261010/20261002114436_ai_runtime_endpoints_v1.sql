-- Atlas One - endpoints privados dos runtimes de IA.
-- Backend-only: clientes anon/authenticated nao recebem acesso a esta tabela.

create table if not exists public.ai_runtime_endpoints (
  chave text primary key,
  base_url text not null,
  ativo boolean not null default true,
  observacao text null,
  updated_at timestamptz not null default now()
);

alter table public.ai_runtime_endpoints
  add column if not exists observacao text null;
alter table public.ai_runtime_endpoints
  add column if not exists updated_at timestamptz not null default now();

alter table public.ai_runtime_endpoints enable row level security;
revoke all on table public.ai_runtime_endpoints from anon, authenticated;
grant select, insert, update, delete on table public.ai_runtime_endpoints to service_role;

comment on table public.ai_runtime_endpoints is
  'Registro backend-only dos endpoints dinamicos do runtime de IA do Atlas One.';
