-- Captura de Largura/Altura/Ambiente/Nome por ocorrência histórica, agregados
-- por tipologia-referência. A API W.Vetro já entrega esses campos em cada item
-- de vendas/pedidos e vendas/orcamentos (achado da auditoria 2026-09-01/02),
-- mas a extração nunca os gravava. Só adição de colunas, aditivo, não altera
-- checkpoint/cursor/retry/pendências nem nenhuma lógica de execução da carga.

alter table public.wvetro_referencias_tipologias
  add column if not exists largura_min_mm numeric,
  add column if not exists largura_max_mm numeric,
  add column if not exists altura_min_mm numeric,
  add column if not exists altura_max_mm numeric,
  add column if not exists ambientes_observados text[] not null default '{}',
  add column if not exists nomes_observados text[] not null default '{}';

comment on column public.wvetro_referencias_tipologias.largura_min_mm is
  'Menor Largura (mm) observada em item histórico de venda/orçamento W.Vetro para esta tipologia-referência.';
comment on column public.wvetro_referencias_tipologias.largura_max_mm is
  'Maior Largura (mm) observada em item histórico de venda/orçamento W.Vetro para esta tipologia-referência.';
comment on column public.wvetro_referencias_tipologias.altura_min_mm is
  'Menor Altura (mm) observada em item histórico de venda/orçamento W.Vetro para esta tipologia-referência.';
comment on column public.wvetro_referencias_tipologias.altura_max_mm is
  'Maior Altura (mm) observada em item histórico de venda/orçamento W.Vetro para esta tipologia-referência.';
comment on column public.wvetro_referencias_tipologias.ambientes_observados is
  'Valores distintos do campo Ambiente observados nos itens históricos (texto livre do vendedor W.Vetro), até 20 valores.';
comment on column public.wvetro_referencias_tipologias.nomes_observados is
  'Valores distintos do campo Nome observados nos itens históricos (mais descritivo que Modelo), até 20 valores, para apoiar a reconstrução de variáveis.';
