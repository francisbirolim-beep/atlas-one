-- Atlas IA — Central de Aprendizado e fila de validação.
-- Tudo entra como candidato; nada vira regra/cadastro técnico oficial sem aprovação.

create table if not exists public.ai_aprendizado_entradas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  tipo text not null default 'outro'
    check (tipo in ('catalogo','tabela_preco','curso','apostila','regra','foto','arquivo','conversa','outro')),
  titulo text not null,
  descricao text null,
  status text not null default 'recebido'
    check (status in ('recebido','analisando','aguardando_validacao','concluido','erro')),
  fonte_nome text null,
  mime_type text null,
  tamanho_bytes bigint null,
  storage_path text null,
  texto_extraido text null,
  resumo_ia text null,
  setores_sugeridos jsonb not null default '[]'::jsonb,
  fornecedor_id_sugerido uuid null references public.fornecedores(id) on delete set null,
  fornecedor_nome_sugerido text null,
  fornecedor_cnpj_sugerido text null,
  criado_por_id uuid null,
  criado_por_nome text null,
  erro text null,
  metadados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_aprendizado_entradas_empresa_status_idx
  on public.ai_aprendizado_entradas (empresa_id, status, created_at desc);
create index if not exists ai_aprendizado_entradas_criado_por_idx
  on public.ai_aprendizado_entradas (empresa_id, criado_por_id, created_at desc);

create table if not exists public.ai_aprendizado_candidatos (
  id uuid primary key default gen_random_uuid(),
  entrada_id uuid not null references public.ai_aprendizado_entradas(id) on delete cascade,
  empresa_id uuid not null,
  tipo text not null
    check (tipo in ('fornecedor','produto','vinculo_fornecedor','preco','conhecimento')),
  modulo text null,
  titulo text not null,
  dados jsonb not null default '{}'::jsonb,
  deduplicacao jsonb not null default '{}'::jsonb,
  acao_sugerida text null,
  confianca numeric null check (confianca is null or (confianca >= 0 and confianca <= 1)),
  status text not null default 'pendente'
    check (status in ('pendente','aprovado','rejeitado','corrigido','aplicado')),
  destino_id uuid null,
  validado_por_id uuid null,
  validado_por_nome text null,
  validado_em timestamptz null,
  observacao_validacao text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_aprendizado_candidatos_fila_idx
  on public.ai_aprendizado_candidatos (empresa_id, status, tipo, created_at desc);
create index if not exists ai_aprendizado_candidatos_entrada_idx
  on public.ai_aprendizado_candidatos (entrada_id, created_at);

create table if not exists public.ai_aprendizado_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  entrada_id uuid null references public.ai_aprendizado_entradas(id) on delete cascade,
  candidato_id uuid null references public.ai_aprendizado_candidatos(id) on delete cascade,
  usuario_id uuid null,
  usuario_nome text null,
  evento text not null,
  detalhe jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_aprendizado_eventos_entrada_idx
  on public.ai_aprendizado_eventos (entrada_id, created_at desc);
create index if not exists ai_aprendizado_eventos_candidato_idx
  on public.ai_aprendizado_eventos (candidato_id, created_at desc);

alter table public.ai_aprendizado_entradas enable row level security;
alter table public.ai_aprendizado_candidatos enable row level security;
alter table public.ai_aprendizado_eventos enable row level security;

revoke all on table public.ai_aprendizado_entradas from anon, authenticated;
revoke all on table public.ai_aprendizado_candidatos from anon, authenticated;
revoke all on table public.ai_aprendizado_eventos from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atlas-aprendizado',
  'atlas-aprendizado',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg','image/png','image/webp','image/gif',
    'text/plain','text/csv','application/json',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on table public.ai_aprendizado_entradas is
  'Documentos, cursos, catálogos, regras e conversas enviados à Central de Aprendizado.';
comment on table public.ai_aprendizado_candidatos is
  'Candidatos extraídos pela IA. Somente após validação são aplicados em fornecedor/produto/preço/conhecimento.';
