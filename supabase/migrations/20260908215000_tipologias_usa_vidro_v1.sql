-- Regra explícita e conservadora de uso de vidro por tipologia.
-- NULL = ainda não classificado; TRUE = vidro obrigatório; FALSE = tipologia sem vidro.
-- Não existe backfill automático para não inferir regra técnica pelo nome da tipologia.

alter table public.tipologias
  add column if not exists usa_vidro boolean null;

comment on column public.tipologias.usa_vidro is
  'NULL: ainda não classificado; TRUE: vidro obrigatório; FALSE: tipologia sem vidro. Não inferir automaticamente.';
