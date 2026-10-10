-- Atlas One AI runtime endpoint registry.
-- Backend-only: stores the public gateway URL that bridges Vercel -> OpenCode -> FreeLLMAPI.
create table if not exists public.ai_runtime_endpoints (
  chave text primary key,
  base_url text not null,
  ativo boolean not null default true,
  observacao text,
  updated_at timestamptz not null default now()
);

alter table public.ai_runtime_endpoints enable row level security;

revoke all on table public.ai_runtime_endpoints from anon, authenticated;
grant select, insert, update, delete on table public.ai_runtime_endpoints to service_role;

comment on table public.ai_runtime_endpoints is
  'Registro backend-only dos endpoints dinamicos do runtime de IA do Atlas One.';

create table if not exists public.ai_runtime_credentials (
  chave text primary key,
  token_hash text not null,
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.ai_runtime_credentials enable row level security;
revoke all on table public.ai_runtime_credentials from anon, authenticated;
grant select, insert, update, delete on table public.ai_runtime_credentials to service_role;

comment on table public.ai_runtime_credentials is
  'Credenciais backend-only do runtime de IA; armazena somente hashes, nunca tokens em texto puro.';
