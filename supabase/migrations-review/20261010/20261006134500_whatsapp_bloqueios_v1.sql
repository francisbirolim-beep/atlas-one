create table if not exists public.atendimento_whatsapp_bloqueios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid not null references public.atendimento_whatsapp_canais(id) on delete cascade,
  chat_jid text not null,
  telefone text,
  ativo boolean not null default true,
  bloqueado_em timestamptz not null default now(),
  bloqueado_por uuid,
  bloqueado_por_nome text,
  desbloqueado_em timestamptz,
  desbloqueado_por uuid,
  desbloqueado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, canal_id, chat_jid)
);

create index if not exists idx_whatsapp_bloqueios_empresa_canal_ativo
  on public.atendimento_whatsapp_bloqueios (empresa_id, canal_id, ativo);

create index if not exists idx_whatsapp_bloqueios_telefone
  on public.atendimento_whatsapp_bloqueios (empresa_id, canal_id, telefone)
  where ativo = true;

alter table public.atendimento_whatsapp_bloqueios enable row level security;
