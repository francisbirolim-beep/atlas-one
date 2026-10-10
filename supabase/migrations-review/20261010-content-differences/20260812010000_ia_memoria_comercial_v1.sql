-- Atlas One — IA Comercial v1
-- Memória persistente de interações e feedback humano.
-- A IA não grava alterações em orçamento/produção; estas tabelas servem apenas
-- para contexto, auditoria e aprendizado supervisionado pelo usuário.

create table if not exists public.ai_interacoes (
  id uuid primary key default gen_random_uuid(),
  contexto text not null default 'comercial',
  usuario_id uuid null,
  usuario_nome text null,
  pergunta text not null,
  resposta text not null,
  modelo text null,
  contexto_json jsonb not null default '{}'::jsonb,
  status text not null default 'ok' check (status in ('ok', 'erro')),
  created_at timestamptz not null default now()
);

create index if not exists ai_interacoes_contexto_created_at_idx
  on public.ai_interacoes (contexto, created_at desc);
create index if not exists ai_interacoes_usuario_created_at_idx
  on public.ai_interacoes (usuario_id, created_at desc);

create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  interacao_id uuid not null references public.ai_interacoes(id) on delete cascade,
  usuario_id uuid null,
  usuario_nome text null,
  avaliacao text not null check (avaliacao in ('aprovado', 'corrigido', 'rejeitado')),
  correcao text null,
  created_at timestamptz not null default now(),
  unique (interacao_id, usuario_id)
);

create index if not exists ai_feedback_interacao_idx on public.ai_feedback (interacao_id);

-- Memórias aprovadas/corrigidas que podem ser reutilizadas como contexto futuro.
create table if not exists public.ai_memorias (
  id uuid primary key default gen_random_uuid(),
  escopo text not null default 'comercial',
  titulo text not null,
  conteudo text not null,
  origem_interacao_id uuid null references public.ai_interacoes(id) on delete set null,
  aprovado_por_id uuid null,
  aprovado_por_nome text null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_memorias_escopo_ativo_idx
  on public.ai_memorias (escopo, ativo, updated_at desc);

alter table public.ai_interacoes enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.ai_memorias enable row level security;

comment on table public.ai_interacoes is 'Histórico auditável das conversas com as IAs do Atlas.';
comment on table public.ai_feedback is 'Aprovações, correções e rejeições humanas usadas para aprendizado contextual.';
comment on table public.ai_memorias is 'Conhecimento aprovado que a IA pode reutilizar em respostas futuras.';
