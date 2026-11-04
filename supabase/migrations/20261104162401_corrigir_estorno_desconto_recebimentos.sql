-- Ajuste idempotente: corrige apenas o estorno de desconto dentro da função existente.
-- Não cria, cancela nem altera nenhum lançamento de cliente durante esta migração.
-- Histórico de migrações anteriores permanece intacto.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '45s';

CREATE OR REPLACE FUNCTION public.ajustar_recebimento_venda_auditado(p_venda_obra_id uuid, p_recebimento_id uuid, p_acao text, p_motivo text, p_novas_formas jsonb DEFAULT NULL::jsonb, p_novo_desconto numeric DEFAULT 0, p_nova_data date DEFAULT NULL::date, p_nova_referencia text DEFAULT NULL::text, p_novas_observacoes text DEFAULT NULL::text, p_valor_esperado numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_empresa uuid := private.current_empresa_id();
  v_usuario uuid := auth.uid();
  v_nome text;
  v_venda public.vendas_obras%rowtype;
  v_rec public.financeiro_recebimentos%rowtype;
  v_conta public.financeiro_contas_receber%rowtype;
  v_allocs jsonb;
  v_formas jsonb;
  v_qtd integer;
  v_qtd_invalidas integer;
  v_soma_recebimento numeric;
  v_soma_desconto numeric;
  v_conta_paga numeric;
  v_conta_valor numeric;
  v_desc numeric;
  v_pago numeric;
  v_data_pagamento date;
  v_forma_residual text;
  v_novo jsonb;
  v_novo_id uuid;
  v_ajuste_id uuid;
  v_item record;
BEGIN
  IF v_usuario IS NULL OR v_empresa IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501';
  END IF;
  SELECT nome INTO v_nome
  FROM public.usuarios
  WHERE id=v_usuario AND empresa_id=v_empresa AND lower(role)='master';
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Somente o Master pode alterar ou cancelar recebimentos.' USING ERRCODE='42501';
  END IF;
  IF p_acao NOT IN ('cancelar','alterar') THEN
    RAISE EXCEPTION 'Operação inválida.' USING ERRCODE='22023';
  END IF;
  IF char_length(trim(coalesce(p_motivo,''))) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'Informe o motivo obrigatório (8 a 500 caracteres).' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_venda
  FROM public.vendas_obras
  WHERE id=p_venda_obra_id AND empresa_id=v_empresa AND status<>'cancelada'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda indisponível.' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_rec
  FROM public.financeiro_recebimentos
  WHERE id=p_recebimento_id AND empresa_id=v_empresa AND cliente_id=v_venda.cliente_id
  FOR UPDATE;
  IF NOT FOUND OR v_rec.status IN ('cancelado','estornado') THEN
    RAISE EXCEPTION 'Recebimento inexistente ou já cancelado.' USING ERRCODE='22023';
  END IF;
  IF v_rec.venda_obra_id IS NOT NULL AND v_rec.venda_obra_id <> p_venda_obra_id THEN
    RAISE EXCEPTION 'Este recebimento está vinculado a outra venda.' USING ERRCODE='22023';
  END IF;
  IF p_valor_esperado IS NOT NULL AND v_rec.valor IS DISTINCT FROM p_valor_esperado THEN
    RAISE EXCEPTION 'O valor deste recebimento mudou. Atualize a venda antes de corrigir.' USING ERRCODE='22023';
  END IF;

  SELECT count(*),
    count(*) FILTER (
      WHERE a.conta_receber_id IS NULL OR c.id IS NULL OR
        c.empresa_id <> v_empresa OR c.venda_obra_id <> p_venda_obra_id OR
        a.tipo NOT IN ('conta','desconto')
    ),
    coalesce(sum(a.valor) FILTER (WHERE a.tipo='conta'),0),
    coalesce(sum(a.valor) FILTER (WHERE a.tipo='desconto'),0)
  INTO v_qtd,v_qtd_invalidas,v_soma_recebimento,v_soma_desconto
  FROM public.financeiro_recebimento_alocacoes a
  LEFT JOIN public.financeiro_contas_receber c ON c.id=a.conta_receber_id
  WHERE a.empresa_id=v_empresa AND a.recebimento_id=v_rec.id;

  -- Não cancelar recebimentos livres, compartilhados entre obras ou alterados
  -- por rotinas legadas que não possam ser conciliados com exatidão.
  IF v_qtd=0 OR v_qtd_invalidas>0 OR abs(v_soma_recebimento-v_rec.valor)>0.009 THEN
    RAISE EXCEPTION 'Este recebimento tem alocações externas ou inconsistentes. Faça a conciliação individual.' USING ERRCODE='22023';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.created_at,a.id),'[]'::jsonb)
  INTO v_allocs
  FROM public.financeiro_recebimento_alocacoes a
  WHERE a.empresa_id=v_empresa AND a.recebimento_id=v_rec.id;

  SELECT coalesce(jsonb_agg(jsonb_build_object('forma',f.forma,'valor',f.valor,'parcelas',f.parcelas) ORDER BY f.ordem),'[]'::jsonb)
  INTO v_formas
  FROM public.financeiro_recebimento_formas f
  WHERE f.empresa_id=v_empresa AND f.recebimento_id=v_rec.id;

  -- Remover apenas as alocações ATIVAS: o cabeçalho, as formas originais e
  -- o snapshot completo permanecem para consulta/auditoria.
  DELETE FROM public.financeiro_recebimento_alocacoes
  WHERE empresa_id=v_empresa AND recebimento_id=v_rec.id;

  FOR v_item IN
    SELECT (x.value->>'conta_receber_id')::uuid AS conta_id,
      coalesce(sum((x.value->>'valor')::numeric) FILTER (WHERE x.value->>'tipo'='conta'),0) AS total_pago,
      coalesce(sum((x.value->>'valor')::numeric) FILTER (WHERE x.value->>'tipo'='desconto'),0) AS total_desconto
    FROM jsonb_array_elements(v_allocs) x
    GROUP BY (x.value->>'conta_receber_id')::uuid
    ORDER BY (x.value->>'conta_receber_id')::uuid
  LOOP
    SELECT * INTO v_conta FROM public.financeiro_contas_receber
    WHERE id=v_item.conta_id AND empresa_id=v_empresa AND venda_obra_id=p_venda_obra_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Parcela indisponível para estorno.'; END IF;
    -- A rotina de recebimento concede abatimento em valor_desconto, SEM reduzir
    -- o valor nominal do título. Estornar deve desfazer precisamente ambos
    -- os acumuladores e preservar integralmente o valor negociado da venda.
    v_pago := round(coalesce(v_conta.valor_pago,0)-v_item.total_pago,2);
    -- O gatilho privado já recalcula valor_desconto a cada DELETE de alocação.
    -- Subtrair novamente o desconto do recibo cancelado faria um estorno duplo.
    -- Ler as alocações remanescentes é idempotente e preserva outros abatimentos.
    SELECT round(coalesce(sum(a.valor),0),2) INTO v_desc
    FROM public.financeiro_recebimento_alocacoes a
    WHERE a.empresa_id=v_empresa
      AND a.conta_receber_id=v_item.conta_id
      AND a.tipo='desconto';
    v_conta_valor := v_conta.valor;
    IF v_pago < -0.009 OR v_desc < -0.009 OR v_pago + v_desc > v_conta_valor+0.009 THEN
      RAISE EXCEPTION 'A parcela foi alterada e não permite estorno seguro.' USING ERRCODE='22023';
    END IF;
    SELECT max(r.data_recebimento)
    INTO v_data_pagamento
    FROM public.financeiro_recebimento_alocacoes a
    JOIN public.financeiro_recebimentos r ON r.id=a.recebimento_id AND r.empresa_id=v_empresa
    WHERE a.empresa_id=v_empresa AND a.conta_receber_id=v_item.conta_id
      AND a.tipo='conta' AND r.status NOT IN ('cancelado','estornado');
    SELECT r.forma INTO v_forma_residual
    FROM public.financeiro_recebimento_alocacoes a
    JOIN public.financeiro_recebimentos r ON r.id=a.recebimento_id AND r.empresa_id=v_empresa
    WHERE a.empresa_id=v_empresa AND a.conta_receber_id=v_item.conta_id
      AND a.tipo='conta' AND r.status NOT IN ('cancelado','estornado')
    ORDER BY r.data_recebimento DESC,r.created_at DESC LIMIT 1;
    UPDATE public.financeiro_contas_receber
    SET valor_pago=greatest(0,v_pago),valor_desconto=greatest(0,v_desc),
      status=CASE
        WHEN v_pago+v_desc>=v_conta_valor-0.009 THEN 'pago'
        WHEN vencimento IS NOT NULL AND vencimento<current_date THEN 'vencido'
        ELSE 'aberto' END,
      data_pagamento=CASE
        WHEN v_pago+v_desc>=v_conta_valor-0.009
          THEN coalesce(v_data_pagamento,v_conta.data_pagamento)
        ELSE NULL END,
      -- Não manter no título a forma do recebimento cancelado.
      forma=v_forma_residual,
      updated_at=now()
    WHERE id=v_conta.id AND empresa_id=v_empresa;
  END LOOP;

  UPDATE public.financeiro_recebimentos
  SET status='cancelado',venda_obra_id=p_venda_obra_id,updated_at=now()
  WHERE id=v_rec.id AND empresa_id=v_empresa;

  IF p_acao='alterar' THEN
    IF p_nova_data IS NULL THEN
      RAISE EXCEPTION 'Informe a nova data do recebimento.';
    END IF;
    v_novo := public.registrar_recebimento_venda_multiforma(
      p_venda_obra_id,v_venda.cliente_id,
      p_novas_formas,p_novo_desconto,p_nova_data,
      p_nova_referencia,p_novas_observacoes
    );
    v_novo_id := (v_novo->>'recebimento_id')::uuid;
  END IF;

  INSERT INTO public.financeiro_recebimento_ajustes(
    empresa_id,venda_obra_id,recebimento_original_id,recebimento_substituto_id,
    acao,motivo,antes,depois,usuario_id,usuario_nome
  ) VALUES (
    v_empresa,p_venda_obra_id,v_rec.id,v_novo_id,
    p_acao,trim(p_motivo),
    jsonb_build_object('recebimento',to_jsonb(v_rec),'alocacoes',v_allocs,'formas',v_formas),
    jsonb_build_object('status_original','cancelado','novo_recebimento_id',v_novo_id,'novo_recebimento',v_novo),
    v_usuario,v_nome
  ) RETURNING id INTO v_ajuste_id;

  RETURN jsonb_build_object(
    'ok',true,'acao',p_acao,'ajuste_id',v_ajuste_id,'recebimento_original_id',v_rec.id,
    'recebimento_novo_id',v_novo_id,'valor_estornado',v_rec.valor,'desconto_estornado',v_soma_desconto
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ajustar_recebimento_venda_auditado(uuid,uuid,text,text,jsonb,numeric,date,text,text,numeric)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajustar_recebimento_venda_auditado(uuid,uuid,text,text,jsonb,numeric,date,text,text,numeric)
TO authenticated;
