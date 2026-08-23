-- Entrada de notas fiscais de compra (XML, PDF/DANFE ou manual)

create table if not exists public.compras_nfs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  origem_entrada text not null check (origem_entrada in ('xml', 'pdf', 'manual')),
  status text not null default 'confirmada' check (status in ('rascunho', 'confirmada', 'cancelada')),
  chave_acesso text,
  numero text,
  serie text,
  data_emissao timestamptz,
  data_entrada timestamptz not null default now(),
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  fornecedor_nome text,
  fornecedor_cnpj text,
  valor_produtos numeric,
  valor_total numeric,
  arquivo_nome text,
  arquivo_path text,
  observacoes text,
  criado_por_id uuid references auth.users(id) on delete set null,
  criado_por_nome text,
  confirmado_em timestamptz,
  confirmado_por_id uuid references auth.users(id) on delete set null,
  confirmado_por_nome text
);

create unique index if not exists compras_nfs_chave_acesso_uidx
  on public.compras_nfs (chave_acesso)
  where chave_acesso is not null and btrim(chave_acesso) <> '';

create index if not exists compras_nfs_fornecedor_idx on public.compras_nfs (fornecedor_id);
create index if not exists compras_nfs_data_emissao_idx on public.compras_nfs (data_emissao desc);

create table if not exists public.compras_nf_itens (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nf_id uuid not null references public.compras_nfs(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  codigo_fornecedor text,
  descricao text not null,
  ncm text,
  cfop text,
  unidade text,
  quantidade numeric not null default 0,
  valor_unitario numeric,
  valor_total numeric,
  custo_unitario numeric,
  vinculo_status text not null default 'pendente' check (vinculo_status in ('vinculado', 'pendente', 'ambiguo')),
  custo_anterior numeric,
  custo_aplicado boolean not null default false,
  dados_origem jsonb
);

create index if not exists compras_nf_itens_nf_idx on public.compras_nf_itens (nf_id);
create index if not exists compras_nf_itens_produto_idx on public.compras_nf_itens (produto_id);
create index if not exists compras_nf_itens_codigo_idx on public.compras_nf_itens (codigo_fornecedor);

alter table public.compras_nfs enable row level security;
alter table public.compras_nf_itens enable row level security;

-- A primeira versão opera por rotas server-side usando service role.
-- Não abrimos políticas diretas para o cliente até o módulo de permissões de Compras ser definido.
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('compras-nfs', 'compras-nfs', false)
  on conflict (id) do update set public = false;
exception when undefined_table then
  null;
end $$;
