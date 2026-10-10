-- Separação entre lista técnica (materiais) e solicitação de cotação (compras).
-- Um card por categoria / venda / pacote; dados de compra e estoque não são alterados.
create table if not exists public.venda_cotacao_lotes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  venda_obra_id uuid not null references public.vendas_obras(id) on delete cascade,
  pacote_id uuid not null references public.pacotes_tecnicos(id),
  categoria text not null check (categoria in ('perfil','acessorios','vidro','outros')),
  status text not null default 'cotacao' check (status in ('cotacao','comprado','entrega','recebido','cancelado')),
  itens jsonb not null default '[]'::jsonb check (jsonb_typeof(itens)='array'),
  quantidade_itens integer not null default 0 check (quantidade_itens>=0),
  versao integer not null default 1 check (versao>0),
  gerado_por_id uuid null,
  gerado_por_nome text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id,venda_obra_id,pacote_id,categoria)
);
create index if not exists venda_cotacao_lotes_venda_idx
  on public.venda_cotacao_lotes(empresa_id,venda_obra_id,created_at desc);
alter table public.venda_cotacao_lotes enable row level security;

-- Preserve o snapshot de cada reemissão, incluindo autor e versão anterior.
create table if not exists public.venda_cotacao_lotes_revisoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  lote_id uuid not null references public.venda_cotacao_lotes(id) on delete cascade,
  versao integer not null,
  itens jsonb not null,
  usuario_id uuid null,
  usuario_nome text null,
  created_at timestamptz not null default now()
);
create index if not exists venda_cotacao_revisoes_lote_idx
  on public.venda_cotacao_lotes_revisoes(empresa_id,lote_id,versao);
alter table public.venda_cotacao_lotes_revisoes enable row level security;

-- Acesso mediado exclusivamente por API autenticada com tenant, via service role.
revoke all on public.venda_cotacao_lotes from public, anon, authenticated;
revoke all on public.venda_cotacao_lotes_revisoes from public, anon, authenticated;
