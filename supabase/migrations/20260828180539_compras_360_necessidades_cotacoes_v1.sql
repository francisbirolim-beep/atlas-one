-- Compras 360 V1: lista de faltas, cotação por fornecedor e acompanhamento.
-- A NF e o recebimento físico continuam sendo as fontes oficiais de financeiro e estoque.

create table if not exists public.compras_necessidades (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'necessidade' check (status in (
    'necessidade', 'cotacao', 'aprovado', 'pedido_emitido',
    'aguardando_entrega', 'recebido', 'cancelado'
  )),
  produto_id uuid references public.produtos(id) on delete set null,
  descricao text not null,
  categoria text,
  quantidade numeric not null check (quantidade > 0),
  unidade text not null default 'UN',
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta','urgente')),
  data_limite date,
  obra_referencia text,
  observacoes text,
  criado_por_id uuid references auth.users(id) on delete set null,
  criado_por_nome text,
  responsavel_id uuid references auth.users(id) on delete set null,
  responsavel_nome text,
  recebido_em timestamptz,
  cancelado_em timestamptz
);

create index if not exists compras_necessidades_status_idx
  on public.compras_necessidades(status, updated_at desc);
create index if not exists compras_necessidades_produto_idx
  on public.compras_necessidades(produto_id);
create index if not exists compras_necessidades_data_limite_idx
  on public.compras_necessidades(data_limite)
  where status not in ('recebido','cancelado');

create table if not exists public.compras_cotacoes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  necessidade_id uuid not null references public.compras_necessidades(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id) on delete restrict,
  preco_unitario numeric not null check (preco_unitario >= 0),
  frete numeric not null default 0 check (frete >= 0),
  prazo_dias integer check (prazo_dias is null or prazo_dias >= 0),
  previsao_entrega date,
  validade date,
  forma_pagamento text,
  observacoes text,
  selecionada boolean not null default false,
  criado_por_id uuid references auth.users(id) on delete set null,
  criado_por_nome text,
  unique (necessidade_id, fornecedor_id)
);

create index if not exists compras_cotacoes_necessidade_idx
  on public.compras_cotacoes(necessidade_id, preco_unitario);
create index if not exists compras_cotacoes_fornecedor_idx
  on public.compras_cotacoes(fornecedor_id, created_at desc);

alter table public.compras_necessidades enable row level security;
alter table public.compras_cotacoes enable row level security;

-- O módulo acessa estas tabelas somente por rotas server-side autenticadas.
revoke all on public.compras_necessidades from anon, authenticated;
revoke all on public.compras_cotacoes from anon, authenticated;
grant all on public.compras_necessidades to service_role;
grant all on public.compras_cotacoes to service_role;

