-- Aditiva: classificação contábil dos lançamentos MANUAIS já existentes.
-- Preserva integralmente ID, valor, anexo, auditoria, compras do Kanban e W.Vetro.
-- Snapshot anterior à adição da coluna de destino.
-- Histórico preservado e acesso restrito a service_role.
CREATE TABLE IF NOT EXISTS public.cmv_backup_pre_etapa_20261014 AS
 SELECT * FROM public.venda_cmv_lancamentos;
ALTER TABLE public.cmv_backup_pre_etapa_20261014 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cmv_backup_pre_etapa_20261014 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cmv_backup_pre_etapa_20261014 TO service_role;

ALTER TABLE public.venda_cmv_lancamentos
 ADD COLUMN IF NOT EXISTS etapa_cmv text NOT NULL DEFAULT 'comprado';
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conname='venda_cmv_lancamentos_etapa_cmv_chk'
   AND conrelid='public.venda_cmv_lancamentos'::regclass
 ) THEN
  ALTER TABLE public.venda_cmv_lancamentos
   ADD CONSTRAINT venda_cmv_lancamentos_etapa_cmv_chk
   CHECK(etapa_cmv IN ('comprado','recebido'));
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_venda_cmv_lancamentos_etapa_v1
 ON public.venda_cmv_lancamentos(empresa_id, venda_obra_id, etapa_cmv)
 WHERE cancelado_em IS NULL;
