-- Mudança aditiva: edição auditada dos lançamentos reais de CMV.
-- NUNCA apagar o comprovante anterior; histórico preserva o caminho anterior.
ALTER TABLE public.venda_cmv_lancamentos
 ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS atualizado_em timestamptz,
 ADD COLUMN IF NOT EXISTS atualizado_por_id uuid,
 ADD COLUMN IF NOT EXISTS atualizado_por_nome text;

CREATE TABLE IF NOT EXISTS public.venda_cmv_lancamentos_historico (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 venda_obra_id uuid NOT NULL REFERENCES public.vendas_obras(id),
 lancamento_id uuid NOT NULL REFERENCES public.venda_cmv_lancamentos(id),
 antes jsonb NOT NULL,
 depois jsonb NOT NULL,
 alterado_por_id uuid,
 alterado_por_nome text,
 alterado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_venda_cmv_historico_lancamento
 ON public.venda_cmv_lancamentos_historico(empresa_id,venda_obra_id,lancamento_id,alterado_em DESC);
ALTER TABLE public.venda_cmv_lancamentos_historico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.venda_cmv_lancamentos_historico FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.venda_cmv_lancamentos_historico TO service_role;

CREATE OR REPLACE FUNCTION public.fn_venda_cmv_auditar_edicao_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $body$
BEGIN
 IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
    OR NEW.venda_obra_id IS DISTINCT FROM OLD.venda_obra_id
    OR NEW.orcamento_id IS DISTINCT FROM OLD.orcamento_id
    OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Vínculo da compra ao cliente/obra não pode mudar';
 END IF;
 IF NEW.versao IS DISTINCT FROM OLD.versao+1
    OR NEW.atualizado_por_id IS NULL OR NULLIF(TRIM(NEW.atualizado_por_nome),'') IS NULL THEN
    RAISE EXCEPTION 'Edição de CMV exige versão e autoria identificadas';
 END IF;
 INSERT INTO public.venda_cmv_lancamentos_historico
   (empresa_id,venda_obra_id,lancamento_id,antes,depois,alterado_por_id,alterado_por_nome,alterado_em)
 VALUES(NEW.empresa_id,NEW.venda_obra_id,NEW.id,to_jsonb(OLD),to_jsonb(NEW),
   NEW.atualizado_por_id,NEW.atualizado_por_nome,COALESCE(NEW.atualizado_em,now()));
 RETURN NEW;
END;
$body$;
REVOKE ALL ON FUNCTION public.fn_venda_cmv_auditar_edicao_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_venda_cmv_auditar_edicao_v1 ON public.venda_cmv_lancamentos;
CREATE TRIGGER trg_venda_cmv_auditar_edicao_v1
 AFTER UPDATE ON public.venda_cmv_lancamentos
 FOR EACH ROW EXECUTE FUNCTION public.fn_venda_cmv_auditar_edicao_v1();
