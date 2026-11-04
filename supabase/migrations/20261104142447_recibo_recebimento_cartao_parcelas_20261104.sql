-- Modalidade do cartão permanece no campo forma; as parcelas são metadado
-- financeiro, não lançamentos adicionais em caixa nem parcelas a receber.
-- NULL preserva integralmente os recebimentos anteriores.
ALTER TABLE public.financeiro_recebimentos
  ADD COLUMN IF NOT EXISTS cartao_parcelas smallint;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financeiro_recebimentos_cartao_parcelas_ck'
      AND conrelid = 'public.financeiro_recebimentos'::regclass
  ) THEN
    ALTER TABLE public.financeiro_recebimentos
      ADD CONSTRAINT financeiro_recebimentos_cartao_parcelas_ck
      CHECK (cartao_parcelas IS NULL OR (forma = 'cartao_credito' AND cartao_parcelas BETWEEN 1 AND 18));
  END IF;
END
$migration$;
