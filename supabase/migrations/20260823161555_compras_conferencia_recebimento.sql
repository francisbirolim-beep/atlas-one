-- Conferência de recebimento de mercadorias vinculada às NFs de compra.
-- Nesta etapa não há movimentação automática de estoque.

create table if not exists public.compras_recebimentos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nf_id uuid not null references public.compras_nfs(id) on delete cascade,
  status text not null default 'concluido' check (status in ('rascunho', 'concluido', 'cancelado')),
  data_recebimento timestamptz not null default now(),
  observacoes text,
  recebido_por_id uuid references auth.users(id) on delete set null,
  recebido_por_nome text
);

create index if not exists compras_recebimentos_nf_idx on public.compras_recebimentos (nf_id);
create index if not exists compras_recebimentos_data_idx on public.compras_recebimentos (data_recebimento desc);

create table if not exists public.compras_recebimento_itens (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recebimento_id uuid not null references public.compras_recebimentos(id) on delete cascade,
  nf_item_id uuid not null references public.compras_nf_itens(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  quantidade_nf numeric not null,
  quantidade_recebida numeric not null default 0,
  quantidade_avariada numeric not null default 0,
  status text not null default 'nao_conferido' check (status in ('ok', 'falta', 'excesso', 'avaria', 'nao_conferido')),
  observacoes text,
  unique (recebimento_id, nf_item_id)
);

create index if not exists compras_recebimento_itens_recebimento_idx on public.compras_recebimento_itens (recebimento_id);
create index if not exists compras_recebimento_itens_nf_item_idx on public.compras_recebimento_itens (nf_item_id);
create index if not exists compras_recebimento_itens_produto_idx on public.compras_recebimento_itens (produto_id);

create table if not exists public.compras_recebimento_fotos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recebimento_id uuid not null references public.compras_recebimentos(id) on delete cascade,
  nf_item_id uuid references public.compras_nf_itens(id) on delete set null,
  arquivo_nome text not null,
  arquivo_path text not null,
  mime_type text,
  legenda text,
  criado_por_id uuid references auth.users(id) on delete set null,
  criado_por_nome text
);

create index if not exists compras_recebimento_fotos_recebimento_idx on public.compras_recebimento_fotos (recebimento_id);

alter table public.compras_recebimentos enable row level security;
alter table public.compras_recebimento_itens enable row level security;
alter table public.compras_recebimento_fotos enable row level security;

-- O módulo opera por rotas server-side com service role. Não há policies diretas ao client nesta fase.
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('compras-recebimentos', 'compras-recebimentos', false)
  on conflict (id) do update set public = false;
exception when undefined_table then
  null;
end $$;
