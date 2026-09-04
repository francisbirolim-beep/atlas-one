create table if not exists public.fornecedor_documentos (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references public.fornecedores(id) on delete cascade,
  tipo text not null default 'catalogo',
  nome_arquivo text not null,
  url text not null,
  mime_type text,
  tamanho_bytes bigint,
  status text not null default 'enviado',
  texto_extraido text,
  extracao_metodo text,
  custo_modelo numeric not null default 0,
  erro text,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fornecedor_documentos_status_chk check (status in ('enviado','extraido','precisa_analise_ia','processado','erro'))
);

create index if not exists fornecedor_documentos_fornecedor_idx on public.fornecedor_documentos(fornecedor_id, created_at desc);

create table if not exists public.fornecedor_catalogo_itens (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.fornecedor_documentos(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  codigo_fornecedor text,
  descricao text not null,
  categoria_sugerida text,
  unidade text,
  preco numeric,
  prazo_dias integer,
  pedido_minimo numeric,
  embalagem text,
  status text not null default 'revisar',
  confianca numeric,
  dados_extraidos jsonb not null default '{}'::jsonb,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fornecedor_catalogo_itens_status_chk check (status in ('revisar','vinculado','criado_pendente','ignorado')),
  constraint fornecedor_catalogo_itens_confianca_chk check (confianca is null or (confianca >= 0 and confianca <= 1))
);

create index if not exists fornecedor_catalogo_itens_fornecedor_idx on public.fornecedor_catalogo_itens(fornecedor_id, created_at desc);
create index if not exists fornecedor_catalogo_itens_documento_idx on public.fornecedor_catalogo_itens(documento_id);
create index if not exists fornecedor_catalogo_itens_produto_idx on public.fornecedor_catalogo_itens(produto_id) where produto_id is not null;

alter table public.produto_fornecedores
  add column if not exists preco_atual numeric,
  add column if not exists prazo_entrega_dias integer,
  add column if not exists pedido_minimo numeric,
  add column if not exists embalagem text,
  add column if not exists observacoes text,
  add column if not exists documento_origem_id uuid references public.fornecedor_documentos(id) on delete set null,
  add column if not exists preco_atualizado_em timestamptz;

create table if not exists public.produto_fornecedor_precos_historico (
  id uuid primary key default gen_random_uuid(),
  produto_fornecedor_id uuid references public.produto_fornecedores(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  preco numeric not null,
  unidade_compra text,
  documento_origem_id uuid references public.fornecedor_documentos(id) on delete set null,
  vigente_em timestamptz not null default now(),
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now()
);

create index if not exists produto_fornecedor_precos_hist_idx on public.produto_fornecedor_precos_historico(produto_id, fornecedor_id, vigente_em desc);

alter table public.fornecedor_documentos enable row level security;
alter table public.fornecedor_catalogo_itens enable row level security;
alter table public.produto_fornecedor_precos_historico enable row level security;

revoke all on table public.fornecedor_documentos from anon, authenticated;
revoke all on table public.fornecedor_catalogo_itens from anon, authenticated;
revoke all on table public.produto_fornecedor_precos_historico from anon, authenticated;
