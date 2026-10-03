create table if not exists public.ai_runtime_endpoints (
  chave text primary key,
  base_url text not null,
  ativo boolean not null default true,
  observacao text,
  updated_at timestamptz not null default now()
);

comment on table public.ai_runtime_endpoints is
  'Endpoints server-side usados por runtimes privados da IA do Atlas One.';

alter table public.ai_runtime_endpoints enable row level security;

revoke all on table public.ai_runtime_endpoints from anon;
revoke all on table public.ai_runtime_endpoints from authenticated;
grant select, insert, update, delete on table public.ai_runtime_endpoints to service_role;
