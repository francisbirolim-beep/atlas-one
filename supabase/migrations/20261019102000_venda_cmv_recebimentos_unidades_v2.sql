-- CMV por categoria: kg, unidade, peça ou pacote, preservando todos os recebimentos anteriores.
-- Executar somente após homologação da prévia, com backup do banco. Sem alterar valores históricos.
ALTER TABLE public.venda_cmv_recebimentos
 ADD COLUMN IF NOT EXISTS quantidade numeric(14,3),
 ADD COLUMN IF NOT EXISTS unidade text,
 ADD COLUMN IF NOT EXISTS preco_unitario numeric(14,4);
ALTER TABLE public.venda_cmv_recebimentos
 ALTER COLUMN peso_kg DROP NOT NULL,
 ALTER COLUMN preco_kg DROP NOT NULL;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='venda_cmv_recebimentos_unidade_v2_chk') THEN
  ALTER TABLE public.venda_cmv_recebimentos ADD CONSTRAINT venda_cmv_recebimentos_unidade_v2_chk
   CHECK ((unidade IS NULL AND quantidade IS NULL AND preco_unitario IS NULL)
    OR (unidade IN ('KG','UN','PC','PCT') AND quantidade>0 AND preco_unitario>0
    AND (unidade='KG' OR quantidade=trunc(quantidade))));
 END IF;
END $$;
-- Campos legados peso_kg/preco_kg continuam disponíveis para registros antigos KG.
-- Não presumir que vidros/acessórios históricos em peso foram efetivamente comprados em KG.
