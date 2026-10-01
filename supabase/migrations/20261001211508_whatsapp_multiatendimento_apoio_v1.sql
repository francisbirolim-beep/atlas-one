-- Recursos internos do multiatendimento WhatsApp.
-- Acesso somente via APIs server-side do Atlas (service role).

create table if not exists public.atendimento_etiquetas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  cor text not null default '#64748b',
  ativo boolean not null default true,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, nome)
);

create table if not exists public.atendimento_conversa_etiquetas (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  conversa_id uuid not null references public.atendimento_conversas(id) on delete cascade,
  etiqueta_id uuid not null references public.atendimento_etiquetas(id) on delete cascade,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (conversa_id, etiqueta_id)
);

create table if not exists public.atendimento_notas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  conversa_id uuid not null references public.atendimento_conversas(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  usuario_nome text,
  texto text not null check (length(trim(texto)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.atendimento_mensagens_rapidas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  atalho text,
  categoria text,
  ativo boolean not null default true,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atendimento_etiquetas_empresa_idx
  on public.atendimento_etiquetas (empresa_id, ativo, nome);
create index if not exists atendimento_conversa_etiquetas_empresa_conversa_idx
  on public.atendimento_conversa_etiquetas (empresa_id, conversa_id);
create index if not exists atendimento_notas_empresa_conversa_idx
  on public.atendimento_notas (empresa_id, conversa_id, created_at desc);
create index if not exists atendimento_mensagens_rapidas_empresa_idx
  on public.atendimento_mensagens_rapidas (empresa_id, ativo, titulo);

alter table public.atendimento_etiquetas enable row level security;
alter table public.atendimento_conversa_etiquetas enable row level security;
alter table public.atendimento_notas enable row level security;
alter table public.atendimento_mensagens_rapidas enable row level security;

revoke all on public.atendimento_etiquetas from anon, authenticated;
revoke all on public.atendimento_conversa_etiquetas from anon, authenticated;
revoke all on public.atendimento_notas from anon, authenticated;
revoke all on public.atendimento_mensagens_rapidas from anon, authenticated;

comment on table public.atendimento_etiquetas is
  'Etiquetas internas compartilhadas do multiatendimento WhatsApp.';
comment on table public.atendimento_conversa_etiquetas is
  'Vinculo de etiquetas internas com conversas WhatsApp.';
comment on table public.atendimento_notas is
  'Notas internas do atendimento, nunca enviadas ao cliente.';
comment on table public.atendimento_mensagens_rapidas is
  'Respostas prontas e atalhos internos para o multiatendimento WhatsApp.';
