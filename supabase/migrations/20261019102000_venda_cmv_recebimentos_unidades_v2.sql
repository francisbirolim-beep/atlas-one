-- CMV por categoria: kg, unidade, peça ou pacote, preservando todos os recebimentos anteriores.
-- Executar somente após homologação da prévia, com backup do banco. Sem alterar valores históricos.
ALTER TABLE public.venda_cmv_recebimentos
 ADD COLUMN IF NOT EXISTS quantidade numeric(14,3),
 ADD COLUMN IF NOT EXISTS unidade text,
 ADD COLUMN IF NOT EXISTS preco_unitario numeric(14,4),
 ADD COLUMN IF NOT EXISTS conferido_em timestamptz,
 ADD COLUMN IF NOT EXISTS conferido_por_id uuid,
 ADD COLUMN IF NOT EXISTS conferido_por_nome text;
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

-- Confirmação auditável e transacional de recebimentos, sem alterar preço, peso,
-- quantidade, nota, vínculo, custo comprado ou status do Kanban.
CREATE OR REPLACE FUNCTION public.fn_venda_cmv_validar_recebimentos_v2(
 p_empresa uuid,p_venda uuid,p_orcamento uuid,p_ids uuid[],
 p_usuario_id uuid,p_usuario_nome text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE confirmados integer; encontrados integer; esperados integer;
BEGIN
 esperados := (SELECT count(DISTINCT x) FROM unnest(p_ids) AS x);
 IF esperados<1 OR esperados>100 OR coalesce(btrim(p_usuario_nome),'')=''
    OR p_usuario_id IS NULL THEN
  RAISE EXCEPTION 'Seleção inválida para confirmar recebimentos';
 END IF;
 SELECT count(*) INTO encontrados FROM (
  SELECT id FROM public.venda_cmv_recebimentos
  WHERE empresa_id=p_empresa AND venda_obra_id=p_venda
   AND orcamento_id=p_orcamento AND id=ANY(p_ids)
   AND cancelado_em IS NULL
  FOR UPDATE
 ) AS bloqueados;
 IF encontrados<>esperados THEN
  RAISE EXCEPTION 'Recebimentos não localizados ou alterados';
 END IF;
 UPDATE public.venda_cmv_recebimentos
 SET conferido_em=now(),conferido_por_id=p_usuario_id,
  conferido_por_nome=p_usuario_nome,atualizado_em=now(),
  atualizado_por_id=p_usuario_id,atualizado_por_nome=p_usuario_nome,
  versao=versao+1
 WHERE empresa_id=p_empresa AND venda_obra_id=p_venda
  AND orcamento_id=p_orcamento AND id=ANY(p_ids)
  AND cancelado_em IS NULL AND conferido_em IS NULL;
 GET DIAGNOSTICS confirmados=ROW_COUNT;
 RETURN confirmados;
END $$;
REVOKE ALL ON FUNCTION public.fn_venda_cmv_validar_recebimentos_v2(uuid,uuid,uuid,uuid[],uuid,text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_venda_cmv_validar_recebimentos_v2(uuid,uuid,uuid,uuid[],uuid,text)
 TO service_role;
