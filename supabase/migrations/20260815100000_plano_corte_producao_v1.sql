-- Plano de corte da Produção
-- Gera um snapshot editável por plano a partir do produto/tipologia/receita técnica.

create table if not exists planos_corte (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references produtos(id) on delete set null,
  tipologia_id uuid references tipologias(id) on delete set null,
  receita_id uuid references engenharia_receitas(id) on delete set null,
  nome text not null,
  largura_mm numeric,
  altura_mm numeric,
  quantidade numeric not null default 1,
  folga_largura_mm numeric not null default 4,
  folga_altura_mm numeric not null default 4,
  variaveis jsonb not null default '{}'::jsonb,
  observacoes text,
  status text not null default 'rascunho' check (status in ('rascunho','liberado')),
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists plano_corte_componentes (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references planos_corte(id) on delete cascade,
  receita_componente_id uuid references engenharia_receita_componentes(id) on delete set null,
  tipo text not null,
  produto_id uuid references produtos(id) on delete set null,
  nome text not null,
  unidade text not null default 'un',
  quantidade numeric not null default 1,
  corte_mm numeric,
  formula_quantidade text,
  formula_corte text,
  observacao text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planos_corte_produto_idx on planos_corte(produto_id);
create index if not exists planos_corte_status_idx on planos_corte(status);
create index if not exists plano_corte_componentes_plano_idx on plano_corte_componentes(plano_id);
