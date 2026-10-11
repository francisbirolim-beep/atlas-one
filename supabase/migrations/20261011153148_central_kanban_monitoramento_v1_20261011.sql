-- Central de acompanhamento: posições dos cards nunca substituem os status de estoque, compra, produção ou financeiro.
create table if not exists public.central_kanban_colunas(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null,
 setor text not null check(setor in ('engenharia','compras','producao','instalacao','financeiro')),
 nome text not null check(char_length(nome) between 2 and 80), ordem integer not null,
 created_at timestamptz not null default now()
);
create unique index if not exists central_kanban_colunas_unica_idx on public.central_kanban_colunas(empresa_id,setor,nome);
create index if not exists central_kanban_colunas_setor_idx on public.central_kanban_colunas(empresa_id,setor,ordem);
create table if not exists public.central_kanban_posicoes(
 empresa_id uuid not null, setor text not null, venda_obra_id uuid not null references public.vendas_obras(id),
 coluna_id uuid not null references public.central_kanban_colunas(id), atualizado_por_id uuid,
 updated_at timestamptz not null default now(),
 primary key(empresa_id,setor,venda_obra_id)
);
create table if not exists public.central_kanban_historico(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null,
 setor text not null, venda_obra_id uuid not null references public.vendas_obras(id),
 coluna_anterior_id uuid, coluna_anterior_nome text, coluna_nova_id uuid, coluna_nova_nome text,
 motivo text, usuario_id uuid not null, usuario_nome text not null, created_at timestamptz not null default now()
);
create index if not exists central_kanban_historico_idx on public.central_kanban_historico(empresa_id,venda_obra_id,created_at desc);
create table if not exists public.central_kanban_comentarios(
 id uuid primary key default gen_random_uuid(), empresa_id uuid not null,
 venda_obra_id uuid not null references public.vendas_obras(id),
 setor text not null check(setor in ('comercial','engenharia','compras','producao','instalacao','financeiro','assistencia')),
 texto text not null check(char_length(texto) between 1 and 2000), usuario_id uuid not null, usuario_nome text not null,
 created_at timestamptz not null default now()
);
create index if not exists central_kanban_comentarios_idx on public.central_kanban_comentarios(empresa_id,venda_obra_id,created_at desc);
create table if not exists public.central_kanban_acessos(
 empresa_id uuid not null, usuario_id uuid not null references public.usuarios(id),
 setor text not null check(setor in ('comercial','engenharia','compras','producao','instalacao','financeiro','assistencia')),
 nivel text not null check(nivel in ('oculto','visualizar','movimentar','administrar')),
 responsavel boolean not null default false, atualizado_em timestamptz not null default now(),
 primary key(empresa_id,usuario_id,setor)
);
alter table public.central_kanban_colunas enable row level security;
alter table public.central_kanban_posicoes enable row level security;
alter table public.central_kanban_historico enable row level security;
alter table public.central_kanban_comentarios enable row level security;
alter table public.central_kanban_acessos enable row level security;
-- Só as rotas autenticadas no servidor usam estas tabelas (service role). Clientes diretos não têm acesso.
revoke all on public.central_kanban_colunas,public.central_kanban_posicoes,public.central_kanban_historico,public.central_kanban_comentarios,public.central_kanban_acessos from anon, authenticated;
