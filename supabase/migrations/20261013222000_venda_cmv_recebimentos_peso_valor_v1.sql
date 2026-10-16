-- Aditiva: nota/romaneio recebidos por obra, independente de compras e do W.Vetro.
-- Não substitui, atualiza ou exclui custo comprado. Não altera Kanban.
CREATE TABLE IF NOT EXISTS public.venda_cmv_recebimentos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 venda_obra_id uuid NOT NULL REFERENCES public.vendas_obras(id),
 orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id),
 categoria text NOT NULL CHECK (categoria IN ('perfil','acessorio','vidro','perda','mao_obra','instalacao','frete','outros')),
 peso_kg numeric(14,3) NOT NULL CHECK (peso_kg>0),
 preco_kg numeric(14,4) NOT NULL CHECK (preco_kg>0),
 valor_total numeric(14,2) NOT NULL CHECK (valor_total>0),
 fornecedor text NOT NULL CHECK (char_length(btrim(fornecedor))>0),
 nota_numero text,
 romaneio_numero text,
 data_recebimento date NOT NULL,
 observacoes text,
 anexo_nome text,
 anexo_path text,
 anexo_mime text,
 versao integer NOT NULL DEFAULT 1 CHECK (versao>0),
 criado_por_id uuid,
 criado_por_nome text,
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz,
 atualizado_por_id uuid,
 atualizado_por_nome text,
 cancelado_em timestamptz,
 cancelado_por_id uuid,
 cancelado_por_nome text,
 motivo_cancelamento text,
 CONSTRAINT recebimento_cmv_documento CHECK (nullif(btrim(coalesce(nota_numero,'')),'') IS NOT NULL
 OR nullif(btrim(coalesce(romaneio_numero,'')),'') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_venda_cmv_recebimentos_venda
 ON public.venda_cmv_recebimentos(empresa_id,venda_obra_id,criado_em DESC);
ALTER TABLE public.venda_cmv_recebimentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.venda_cmv_recebimentos FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.venda_cmv_recebimentos TO service_role;

CREATE TABLE IF NOT EXISTS public.venda_cmv_recebimentos_historico (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id),
 venda_obra_id uuid NOT NULL REFERENCES public.vendas_obras(id),
 recebimento_id uuid NOT NULL REFERENCES public.venda_cmv_recebimentos(id),
 antes jsonb NOT NULL,
 depois jsonb NOT NULL,
 alterado_por_id uuid,
 alterado_por_nome text,
 alterado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_venda_cmv_recebimentos_historico
 ON public.venda_cmv_recebimentos_historico(empresa_id,venda_obra_id,recebimento_id,alterado_em DESC);
ALTER TABLE public.venda_cmv_recebimentos_historico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.venda_cmv_recebimentos_historico FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.venda_cmv_recebimentos_historico TO service_role;

CREATE OR REPLACE FUNCTION public.fn_venda_cmv_recebimentos_auditar_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $body$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
 OR NEW.venda_obra_id IS DISTINCT FROM OLD.venda_obra_id OR NEW.orcamento_id IS DISTINCT FROM OLD.orcamento_id THEN
 RAISE EXCEPTION 'Vínculo do recebimento não pode ser alterado';
 END IF;
 IF NEW.versao IS DISTINCT FROM OLD.versao+1 OR NEW.atualizado_por_id IS NULL
 OR NULLIF(btrim(NEW.atualizado_por_nome),'') IS NULL THEN
 RAISE EXCEPTION 'Correção de recebimento exige versão e autoria';
 END IF;
 INSERT INTO public.venda_cmv_recebimentos_historico
 (empresa_id,venda_obra_id,recebimento_id,antes,depois,alterado_por_id,alterado_por_nome,alterado_em)
 VALUES(NEW.empresa_id,NEW.venda_obra_id,NEW.id,to_jsonb(OLD),to_jsonb(NEW),
 NEW.atualizado_por_id,NEW.atualizado_por_nome,COALESCE(NEW.atualizado_em,now()));
 RETURN NEW;
END;
$body$;
REVOKE ALL ON FUNCTION public.fn_venda_cmv_recebimentos_auditar_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_venda_cmv_recebimentos_auditar_v1 ON public.venda_cmv_recebimentos;
CREATE TRIGGER trg_venda_cmv_recebimentos_auditar_v1
 AFTER UPDATE ON public.venda_cmv_recebimentos
 FOR EACH ROW EXECUTE FUNCTION public.fn_venda_cmv_recebimentos_auditar_v1();
