-- Engenharia / Plano de Corte — receitas orientadas a produto
--
-- A modelagem inicial permitia somente uma receita ativa por tipologia.
-- Isso nao atende produtos diferentes da mesma tipologia (ex.: porta de correr
-- 2F, 3F, 4F, linhas distintas e variantes). Esta migration preserva a receita
-- generica por tipologia como fallback e permite uma receita ativa especifica
-- por produto cadastrado.

alter table public.engenharia_receitas
  add column if not exists produto_id uuid references public.produtos(id) on delete set null;

-- A restricao antiga bloqueava mais de uma receita ativa dentro da mesma tipologia.
drop index if exists public.engenharia_receitas_tipologia_ativa_uidx;

-- Continua permitido no maximo um fallback generico ativo por tipologia.
create unique index if not exists engenharia_receitas_tipologia_generica_ativa_uidx
  on public.engenharia_receitas(tipologia_id)
  where ativo = true and produto_id is null;

-- Cada produto pode ter no maximo uma receita tecnica ativa.
create unique index if not exists engenharia_receitas_produto_ativa_uidx
  on public.engenharia_receitas(produto_id)
  where ativo = true and produto_id is not null;

create index if not exists engenharia_receitas_produto_idx
  on public.engenharia_receitas(produto_id, ativo, versao desc);

comment on column public.engenharia_receitas.produto_id is
  'Produto especifico desta receita. NULL = receita generica/fallback da tipologia.';
