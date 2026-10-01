
create table if not exists public.atendimento_etiquetas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  nome text not null,
  cor text not null default '#64748b',
  ativo boolean not null default true,
  created_by uuid references public.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, nome)
);

create table if not exists public.atendimento_conversa_etiquetas (
  empresa_id uuid not null references public.empresas(id),
  conversa_id uuid not null references public.atendimento_conversas(id),
  etiqueta_id uuid not null references public.atendimento_etiquetas(id),
  created_by uuid references public.usuarios(id),
  created_at timestamptz not null default now(),
  primary key (conversa_id, etiqueta_id)
);

create table if not exists public.atendimento_notas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  conversa_id uuid not null references public.atendimento_conversas(id),
  usuario_id uuid references public.usuarios(id),
  usuario_nome text,
  texto text not null check (length(trim(texto)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.atendimento_mensagens_rapidas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  titulo text not null,
  mensagem text not null,
  atalho text,
  categoria text,
  ativo boolean not null default true,
  created_by uuid references public.usuarios(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
