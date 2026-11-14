-- Ajuste isolado do Kanban Comercial: mover cartão não é validar orçamento.
-- Mantém a exigência de motivo na coluna Em andamento e todas as demais
-- proteções existentes (RLS por empresa, venda confirmada, auditoria).
-- Preserva literalmente os status/snapshots da validação W.Vetro.
CREATE OR REPLACE FUNCTION public.validar_etapa_andamento_orcamento_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE nome_destino text;
BEGIN
  IF new.coluna_id IS NULL THEN RETURN new; END IF;
  IF tg_op='UPDATE' THEN
    IF new.coluna_id IS NOT DISTINCT FROM old.coluna_id THEN RETURN new; END IF;
  END IF;

  SELECT lower(btrim(k.nome)) INTO nome_destino
  FROM public.kanban_colunas k
  WHERE k.id = new.coluna_id AND k.empresa_id = new.empresa_id;

  -- Regra antiga preservada: motivo obrigatório para Em andamento.
  IF nome_destino='em andamento'
    AND length(btrim(coalesce(new.kanban_motivo_andamento,''))) < 8 THEN
    RAISE EXCEPTION 'Informe por que o orçamento está em andamento (mínimo 8 caracteres).';
  END IF;

  -- Não bloquear a movimentação conforme o status de conferência W.Vetro.
  -- Uma mudança de coluna não marca itens como validados nem confirma venda.
  RETURN new;
END
$function$;
