-- Atlas One — conhecimento supervisionado por setor/especialista.
-- Material enviado nunca vira regra oficial sem validacao humana.

create table if not exists public.ai_conhecimento_setor (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  modulo text not null check (modulo in (
    'gestao','comercial','orcamento','medicao_final','engenharia','compras','estoque',
    'producao','instalacao','financeiro','marketing','rh','qualidade','pd'
  )),
  titulo text not null,
  conteudo text not null,
  resumo_ia text null,
  fonte_tipo text not null default 'texto' check (fonte_tipo in ('texto','pdf','imagem','arquivo','conversa')),
  fonte_nome text null,
  storage_path text null,
  status text not null default 'pendente' check (status in ('pendente','validado','rejeitado','obsoleto')),
  criado_por_id uuid null,
  criado_por_nome text null,
  validado_por_id uuid null,
  validado_por_nome text null,
  validado_em timestamptz null,
  correcao_validacao text null,
  memoria_id uuid null references public.ai_memorias(id) on delete set null,
  versao integer not null default 1 check (versao > 0),
  metadados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conhecimento_setor_empresa_modulo_status_idx
  on public.ai_conhecimento_setor (empresa_id, modulo, status, updated_at desc);

create index if not exists ai_conhecimento_setor_criado_por_idx
  on public.ai_conhecimento_setor (empresa_id, criado_por_id, created_at desc);

create table if not exists public.ai_conhecimento_setor_eventos (
  id uuid primary key default gen_random_uuid(),
  conhecimento_id uuid not null references public.ai_conhecimento_setor(id) on delete cascade,
  empresa_id uuid not null,
  usuario_id uuid null,
  usuario_nome text null,
  evento text not null,
  detalhe jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_conhecimento_setor_eventos_item_idx
  on public.ai_conhecimento_setor_eventos (conhecimento_id, created_at desc);

alter table public.ai_conhecimento_setor enable row level security;
alter table public.ai_conhecimento_setor_eventos enable row level security;

-- Sem policies diretas: leitura/escrita acontece somente pelo backend service-role,
-- onde tenant e permissao do setor sao validados.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atlas-conhecimento',
  'atlas-conhecimento',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/csv',
    'application/json'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on table public.ai_conhecimento_setor is
  'Conhecimento candidato por especialista/setor. Somente status validado entra na memoria oficial da IA.';
comment on table public.ai_conhecimento_setor_eventos is
  'Trilha de auditoria de envio, validacao, correcao, rejeicao e obsolescencia do conhecimento setorial.';
