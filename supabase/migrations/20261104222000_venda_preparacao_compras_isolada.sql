-- Preparação de compras totalmente independente da composição técnica e do plano de corte.
-- Nenhuma escrita ocorre em pacotes_tecnicos, pacote_tecnico_materiais ou estoque.
begin;
create table if not exists public.venda_preparacao_compras (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id),
 venda_obra_id uuid not null references public.vendas_obras(id),
 categoria text not null check (categoria in ('perfil','acessorio','vidro')),
 chave_item text not null,
 origem text not null default 'tipologia' check (origem in ('tipologia','wvetro','manual')),
 codigo text not null,
 descricao text not null,
 cor text not null default '',
 medida text not null default '',
 unidade text not null default 'UN',
 quantidade_necessaria numeric not null check (quantidade_necessaria >= 0),
 quantidade_estoque numeric not null default 0 check (quantidade_estoque >= 0),
 quantidade_comprar numeric not null default 0 check (quantidade_comprar >= 0),
 fonte_hash text not null,
 estoque_conferido boolean not null default false,
 justificativa text,
 solicitacao_id uuid references public.compras_solicitacoes(id),
 enviado_em timestamptz,
 revisao integer not null default 1,
 atualizado_por_id uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (empresa_id,venda_obra_id,categoria,chave_item)
);
create index if not exists venda_preparacao_compras_venda_idx
 on public.venda_preparacao_compras (empresa_id,venda_obra_id,categoria);
alter table public.venda_preparacao_compras enable row level security;
revoke all on public.venda_preparacao_compras from public,anon,authenticated;
grant all on public.venda_preparacao_compras to service_role;
-- Uma única emissão por venda/categoria, mesmo com cliques simultâneos.
create table if not exists public.venda_preparacao_envios (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id),
 venda_obra_id uuid not null references public.vendas_obras(id),
 categoria text not null check (categoria in ('perfil','acessorio','vidro')),
 status text not null default 'reservado' check (status in ('reservado','enviado')),
 solicitacao_id uuid references public.compras_solicitacoes(id),
 criado_por_id uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (empresa_id,venda_obra_id,categoria)
);
alter table public.venda_preparacao_envios enable row level security;
revoke all on public.venda_preparacao_envios from public,anon,authenticated;
grant all on public.venda_preparacao_envios to service_role;
commit;