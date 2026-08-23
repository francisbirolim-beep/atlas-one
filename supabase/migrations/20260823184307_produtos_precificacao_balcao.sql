-- Atlas One — precificação de venda balcão separada do custo técnico.
-- Regra: tipologias consomem produtos.custo; venda balcão usa produtos.preco.
-- margem_percentual passa a representar margem real sobre o preço de venda:
-- margem = (preco - custo) / preco * 100.

alter table public.produtos
  add column if not exists preco_minimo numeric,
  add column if not exists preco_promocional numeric,
  add column if not exists ultimo_preco_vendido numeric,
  add column if not exists ultimo_preco_vendido_em timestamptz;

-- O Atlas antigo tratava margem_percentual como markup sobre o custo.
-- Para registros já precificados, preserva custo e preço praticado e converte
-- somente a porcentagem para a margem real correspondente.
update public.produtos
set margem_percentual = round((((preco - custo) / preco) * 100)::numeric, 4)
where margem_percentual is not null
  and custo is not null
  and custo >= 0
  and preco is not null
  and preco > 0;

alter table public.produtos
  drop constraint if exists produtos_preco_minimo_nao_negativo,
  add constraint produtos_preco_minimo_nao_negativo check (preco_minimo is null or preco_minimo >= 0),
  drop constraint if exists produtos_preco_promocional_nao_negativo,
  add constraint produtos_preco_promocional_nao_negativo check (preco_promocional is null or preco_promocional >= 0),
  drop constraint if exists produtos_ultimo_preco_vendido_nao_negativo,
  add constraint produtos_ultimo_preco_vendido_nao_negativo check (ultimo_preco_vendido is null or ultimo_preco_vendido >= 0),
  drop constraint if exists produtos_margem_balcao_valida,
  add constraint produtos_margem_balcao_valida check (margem_percentual is null or (margem_percentual >= 0 and margem_percentual < 100));

comment on column public.produtos.custo is 'Custo técnico/estoque do produto. É o valor consumido pelas tipologias e pelo custo da obra.';
comment on column public.produtos.preco is 'Preço normal de venda balcão. Não deve ser usado como custo de tipologia.';
comment on column public.produtos.margem_percentual is 'Margem real de venda balcão: (preço - custo) / preço * 100. Não é markup.';
comment on column public.produtos.preco_minimo is 'Preço mínimo comercial opcional para venda balcão.';
comment on column public.produtos.preco_promocional is 'Preço promocional opcional para venda balcão.';
comment on column public.produtos.ultimo_preco_vendido is 'Último preço unitário efetivamente vendido em orçamento/venda balcão.';
