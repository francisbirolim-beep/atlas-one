create table if not exists public.atendimento_acompanhamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  conversa_id uuid not null references public.atendimento_conversas(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (conversa_id, usuario_id)
);

create index if not exists atendimento_acompanhamentos_empresa_usuario_idx
  on public.atendimento_acompanhamentos (empresa_id, usuario_id, created_at desc);
create index if not exists atendimento_acompanhamentos_conversa_idx
  on public.atendimento_acompanhamentos (conversa_id);

alter table public.atendimento_acompanhamentos enable row level security;
revoke all on public.atendimento_acompanhamentos from anon, authenticated;
