-- Margem do orçamento passa a representar markup sobre custo.
-- Ex.: 100% = custo x 2. A sobra cobrada continua adicionada a custo, sem markup.

alter table public.orcamentos
  drop constraint if exists orcamentos_margem_padrao_pct_check;
alter table public.orcamentos
  add constraint orcamentos_margem_padrao_pct_check
  check (margem_padrao_pct >= 0);

alter table public.orcamento_precificacao_componentes
  drop constraint if exists orcamento_precificacao_componentes_margem_pct_check;
alter table public.orcamento_precificacao_componentes
  add constraint orcamento_precificacao_componentes_margem_pct_check
  check (margem_pct >= 0);

alter table public.orcamento_margens_cidade
  drop constraint if exists orcamento_margens_cidade_margem_pct_check;
alter table public.orcamento_margens_cidade
  add constraint orcamento_margens_cidade_margem_pct_check
  check (margem_pct >= 0);

comment on column public.orcamentos.margem_padrao_pct is
  'Markup percentual padrão sobre o custo produtivo/extras. Ex.: 100 = custo x 2. Sobra cobrada é adicionada separadamente a custo.';

comment on column public.orcamento_precificacao_componentes.margem_pct is
  'Markup percentual usado na simulação de venda do componente; pode ser >= 100%.';

comment on column public.orcamento_margens_cidade.margem_pct is
  'Markup percentual sugerido por cidade para orçamento; pode ser >= 100%.';