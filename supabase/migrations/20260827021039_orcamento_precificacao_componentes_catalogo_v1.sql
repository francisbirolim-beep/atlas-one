create table if not exists public.catalogo_custos_tecnicos (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('perfil','acessorio','vidro','mao_obra','instalacao','deslocamento','frete','pintura','terceiro','consumivel','outro')),
  produto_id uuid references public.produtos(id) on delete set null,
  chave text,
  codigo text,
  descricao text not null,
  unidade text not null default 'UN',
  custo_unitario numeric not null default 0 check (custo_unitario >= 0),
  ativo boolean not null default true,
  observacoes text,
  atualizado_por_id uuid,
  atualizado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists catalogo_custos_tecnicos_produto_uq on public.catalogo_custos_tecnicos(produto_id) where produto_id is not null and ativo=true;
create unique index if not exists catalogo_custos_tecnicos_chave_uq on public.catalogo_custos_tecnicos(categoria, lower(chave)) where chave is not null and ativo=true;
create index if not exists catalogo_custos_tecnicos_categoria_idx on public.catalogo_custos_tecnicos(categoria,ativo,descricao);

create table if not exists public.orcamento_precificacao_componentes (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  pacote_id uuid references public.pacotes_tecnicos(id) on delete set null,
  material_id uuid references public.pacote_tecnico_materiais(id) on delete set null,
  item_ref text,
  categoria text not null check (categoria in ('perfil','acessorio','vidro','mao_obra','instalacao','deslocamento','frete','pintura','terceiro','consumivel','outro')),
  produto_id uuid references public.produtos(id) on delete set null,
  catalogo_custo_id uuid references public.catalogo_custos_tecnicos(id) on delete set null,
  codigo text,
  descricao text not null,
  unidade text not null default 'UN',
  quantidade numeric not null default 0 check (quantidade >= 0),
  custo_unitario numeric not null default 0 check (custo_unitario >= 0),
  custo_total numeric not null default 0 check (custo_total >= 0),
  margem_pct numeric not null default 40 check (margem_pct >= 0 and margem_pct < 100),
  preco_venda numeric not null default 0 check (preco_venda >= 0),
  origem_custo text not null default 'catalogo' check (origem_custo in ('produto','catalogo','calculado','manual','pendente')),
  custo_pendente boolean not null default false,
  incluido_manual boolean not null default false,
  excluido boolean not null default false,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orcamento_precificacao_componentes_orc_idx on public.orcamento_precificacao_componentes(orcamento_id,categoria,item_ref);
create index if not exists orcamento_precificacao_componentes_produto_idx on public.orcamento_precificacao_componentes(produto_id);

create table if not exists public.orcamento_item_precificacao (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  item_ref text not null,
  margem_herda_geral boolean not null default true,
  margem_pct numeric,
  sobra_herda_geral boolean not null default true,
  cobrar_sobra boolean,
  custo_produtivo numeric not null default 0,
  custo_sobra numeric not null default 0,
  custo_extras numeric not null default 0,
  custo_total numeric not null default 0,
  preco_venda numeric not null default 0,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(orcamento_id,item_ref)
);

alter table public.catalogo_custos_tecnicos enable row level security;
alter table public.orcamento_precificacao_componentes enable row level security;
alter table public.orcamento_item_precificacao enable row level security;

drop policy if exists catalogo_custos_tecnicos_auth_all on public.catalogo_custos_tecnicos;
create policy catalogo_custos_tecnicos_auth_all on public.catalogo_custos_tecnicos for all to authenticated using (true) with check (true);
drop policy if exists orcamento_precificacao_componentes_auth_all on public.orcamento_precificacao_componentes;
create policy orcamento_precificacao_componentes_auth_all on public.orcamento_precificacao_componentes for all to authenticated using (true) with check (true);
drop policy if exists orcamento_item_precificacao_auth_all on public.orcamento_item_precificacao;
create policy orcamento_item_precificacao_auth_all on public.orcamento_item_precificacao for all to authenticated using (true) with check (true);

grant select,insert,update,delete on public.catalogo_custos_tecnicos to authenticated;
grant select,insert,update,delete on public.orcamento_precificacao_componentes to authenticated;
grant select,insert,update,delete on public.orcamento_item_precificacao to authenticated;

drop trigger if exists catalogo_custos_tecnicos_updated_at on public.catalogo_custos_tecnicos;
create trigger catalogo_custos_tecnicos_updated_at before update on public.catalogo_custos_tecnicos for each row execute function public.update_updated_at();
drop trigger if exists orcamento_precificacao_componentes_updated_at on public.orcamento_precificacao_componentes;
create trigger orcamento_precificacao_componentes_updated_at before update on public.orcamento_precificacao_componentes for each row execute function public.update_updated_at();
drop trigger if exists orcamento_item_precificacao_updated_at on public.orcamento_item_precificacao;
create trigger orcamento_item_precificacao_updated_at before update on public.orcamento_item_precificacao for each row execute function public.update_updated_at();
