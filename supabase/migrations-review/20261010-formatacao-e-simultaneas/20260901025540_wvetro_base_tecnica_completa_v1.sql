-- Base técnica completa W.Vetro -> Atlas.
-- Mantém o histórico bruto separado da engenharia oficial validada.

create table if not exists public.wvetro_tipologia_componentes (
  id uuid primary key default gen_random_uuid(),
  referencia_tipologia_id uuid not null references public.wvetro_referencias_tipologias(id) on delete cascade,
  tipologia_atlas_id uuid null references public.tipologias(id) on delete set null,
  tipo text not null check (tipo in ('perfil','acessorio','vidro')),
  chave_componente text not null,
  produto_atlas_id uuid null references public.produtos(id) on delete set null,
  codigo text null,
  codigo_wvetro text null,
  nome text not null,
  cor text null,
  unidade_origem text null,
  ncm text null,
  imagem_url text null,
  ocorrencias integer not null default 0,
  quantidade_min numeric null,
  quantidade_max numeric null,
  quantidade_soma numeric not null default 0,
  medida_min numeric null,
  medida_max numeric null,
  custo_min numeric null,
  custo_max numeric null,
  custo_ultimo numeric null,
  venda_min numeric null,
  venda_max numeric null,
  venda_ultimo numeric null,
  ultimo_custo_em date null,
  posicoes jsonb not null default '[]'::jsonb,
  cortes jsonb not null default '[]'::jsonb,
  dados_origem jsonb not null default '{}'::jsonb,
  primeiro_visto date null,
  ultimo_visto date null,
  status_mapeamento text not null default 'referencia' check (status_mapeamento in ('referencia','mapeada_exata','pendente_revisao','ignorada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (referencia_tipologia_id, tipo, chave_componente)
);

create index if not exists idx_wvetro_tipologia_componentes_tipologia
  on public.wvetro_tipologia_componentes(tipologia_atlas_id)
  where tipologia_atlas_id is not null;
create index if not exists idx_wvetro_tipologia_componentes_produto
  on public.wvetro_tipologia_componentes(produto_atlas_id)
  where produto_atlas_id is not null;
create index if not exists idx_wvetro_tipologia_componentes_ref
  on public.wvetro_tipologia_componentes(referencia_tipologia_id);

alter table public.wvetro_tipologia_componentes enable row level security;
revoke all on public.wvetro_tipologia_componentes from anon, authenticated;

alter table public.produtos
  add column if not exists custo_wvetro_min numeric null,
  add column if not exists custo_wvetro_max numeric null,
  add column if not exists custo_wvetro_ultimo numeric null,
  add column if not exists custo_wvetro_atualizado_em timestamptz null,
  add column if not exists venda_wvetro_min numeric null,
  add column if not exists venda_wvetro_max numeric null,
  add column if not exists venda_wvetro_ultimo numeric null;

comment on table public.wvetro_tipologia_componentes is
  'Staging auditável da composição observada no W.Vetro por Linha+Modelo. Não substitui receitas/fórmulas Atlas validadas.';
comment on column public.produtos.custo_wvetro_min is 'Menor custo observado no histórico W.Vetro para o código exato.';
comment on column public.produtos.custo_wvetro_max is 'Maior custo observado no histórico W.Vetro para o código exato.';
comment on column public.produtos.custo_wvetro_ultimo is 'Último custo observado cronologicamente no W.Vetro para o código exato.';
