-- Cancelamento reversivel, sem DELETE fisico: manter comprovante e historico.
-- O trigger da migracao de edicao grava OLD/NEW na mesma transacao.
ALTER TABLE public.venda_cmv_lancamentos
 ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
 ADD COLUMN IF NOT EXISTS cancelado_por_id uuid,
 ADD COLUMN IF NOT EXISTS cancelado_por_nome text,
 ADD COLUMN IF NOT EXISTS motivo_cancelamento text;
CREATE INDEX IF NOT EXISTS idx_venda_cmv_ativos_por_venda
 ON public.venda_cmv_lancamentos(empresa_id,venda_obra_id,created_at DESC)
 WHERE cancelado_em IS NULL;
COMMENT ON COLUMN public.venda_cmv_lancamentos.cancelado_em IS
 'Se preenchido, o lançamento foi excluido logicamente do CMV e deve permanecer no historico.';
