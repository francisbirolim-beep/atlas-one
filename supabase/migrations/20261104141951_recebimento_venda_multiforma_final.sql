-- Recebimento único com composição por forma: o financeiro segue com um cabeçalho
-- e uma única distribuição entre parcelas. Os detalhes NÃO geram nova receita.
CREATE TABLE IF NOT EXISTS public.financeiro_recebimento_formas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  recebimento_id uuid NOT NULL REFERENCES public.financeiro_recebimentos(id) ON DELETE CASCADE,
  ordem integer NOT NULL CHECK (ordem BETWEEN 1 AND 30),
  forma text NOT NULL CHECK (forma IN ('pix','dinheiro','boleto','cartao','cartao_credito','cartao_debito','transferencia','cheque')),
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  parcelas smallint,
  CONSTRAINT financeiro_recebimento_formas_parcelas_chk CHECK (
    (forma='cartao_credito' AND parcelas BETWEEN 1 AND 36) OR
    (forma<>'cartao_credito' AND parcelas IS NULL)
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(recebimento_id, ordem)
);
CREATE INDEX IF NOT EXISTS idx_recebimento_formas_tenant_rec
  ON public.financeiro_recebimento_formas(empresa_id,recebimento_id);

-- Defesa no banco: a rotina antiga de correção só atualiza o total do
-- cabeçalho. Proibir essa operação quando há composição por forma, inclusive
-- se ela for chamada diretamente por RPC, para não desalinhar os valores.
CREATE OR REPLACE FUNCTION private.bloquear_edicao_valor_recebimento_composto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path='public','private','pg_temp'
AS $function$
BEGIN
  IF OLD.valor IS DISTINCT FROM NEW.valor AND EXISTS (
    SELECT 1
      FROM public.financeiro_recebimento_formas f
     WHERE f.recebimento_id=OLD.id AND f.empresa_id=OLD.empresa_id
  ) THEN
    RAISE EXCEPTION 'Recebimento com formas detalhadas: utilize alteração auditada.'
      USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.bloquear_edicao_valor_recebimento_composto()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_recebimento_composicao_valor_imutavel
  ON public.financeiro_recebimentos;
CREATE TRIGGER trg_recebimento_composicao_valor_imutavel
  BEFORE UPDATE OF valor ON public.financeiro_recebimentos
  FOR EACH ROW EXECUTE FUNCTION private.bloquear_edicao_valor_recebimento_composto();

ALTER TABLE public.financeiro_recebimento_formas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recebimento_formas_tenant_select ON public.financeiro_recebimento_formas;
CREATE POLICY recebimento_formas_tenant_select ON public.financeiro_recebimento_formas
  FOR SELECT TO authenticated
  USING (
    empresa_id = (SELECT private.current_empresa_id())
    AND EXISTS (
      SELECT 1 FROM public.financeiro_recebimentos r
      WHERE r.id = recebimento_id AND r.empresa_id = public.financeiro_recebimento_formas.empresa_id
    )
  );
REVOKE ALL ON public.financeiro_recebimento_formas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.financeiro_recebimento_formas TO authenticated;

-- Toda a operação ocorre numa mesma transação PostgreSQL. Falha ao gravar
-- uma linha de pagamento reverte também a baixa principal e suas alocações.
CREATE OR REPLACE FUNCTION public.registrar_recebimento_venda_multiforma(
  p_venda_obra_id uuid,
  p_cliente_id uuid,
  p_formas jsonb,
  p_desconto numeric DEFAULT 0,
  p_data_recebimento date DEFAULT current_date,
  p_referencia text DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_empresa_id uuid := private.current_empresa_id();
  v_forma text;
  v_valor_texto text;
  v_valor numeric;
  v_parcelas integer;
  v_total numeric := 0;
  v_ordem integer := 0;
  v_resultado jsonb;
  v_recebimento_id uuid;
  v_item record;
BEGIN
  IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501';
  END IF;
  IF p_formas IS NULL OR jsonb_typeof(p_formas) <> 'array' THEN
    RAISE EXCEPTION 'Informe as formas de pagamento.' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_formas) < 1 OR jsonb_array_length(p_formas) > 30 THEN
    RAISE EXCEPTION 'Informe de 1 a 30 formas de pagamento.' USING ERRCODE='22023';
  END IF;
  IF p_data_recebimento > current_date THEN
    RAISE EXCEPTION 'A data do recebimento não pode ser futura.' USING ERRCODE='22023';
  END IF;
  IF p_desconto IS NULL OR p_desconto < 0 OR p_desconto <> round(p_desconto,2) THEN
    RAISE EXCEPTION 'Desconto inválido.' USING ERRCODE='22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_formas) LOOP
    IF jsonb_typeof(v_item.value) <> 'object' THEN
      RAISE EXCEPTION 'Linha de pagamento inválida.' USING ERRCODE='22023';
    END IF;
    v_forma := lower(btrim(coalesce(v_item.value->>'forma','')));
    IF v_forma NOT IN ('pix','dinheiro','boleto','cartao_credito','cartao_debito','transferencia','cheque') THEN
      RAISE EXCEPTION 'Forma de pagamento inválida: %',v_forma USING ERRCODE='22023';
    END IF;
    v_valor_texto := v_item.value->>'valor';
    IF v_valor_texto IS NULL OR v_valor_texto !~ '^[0-9]+([.][0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Valor de pagamento inválido.' USING ERRCODE='22023';
    END IF;
    v_valor := v_valor_texto::numeric;
    IF v_forma = 'cartao_credito' THEN
      IF coalesce(v_item.value->>'parcelas','') !~ '^[0-9]{1,2}$' THEN
        RAISE EXCEPTION 'Informe a quantidade de parcelas do cartão de crédito.' USING ERRCODE='22023';
      END IF;
      v_parcelas := (v_item.value->>'parcelas')::integer;
      IF v_parcelas NOT BETWEEN 1 AND 36 THEN
        RAISE EXCEPTION 'Quantidade de parcelas deve ser de 1 a 36.' USING ERRCODE='22023';
      END IF;
    ELSIF v_item.value ? 'parcelas' AND v_item.value->>'parcelas' IS NOT NULL THEN
      RAISE EXCEPTION 'Parcelamento só é permitido no cartão de crédito.' USING ERRCODE='22023';
    END IF;
    IF v_valor <= 0 OR v_valor > 999999999999.99 THEN
      RAISE EXCEPTION 'Valor de pagamento fora do limite.' USING ERRCODE='22023';
    END IF;
    v_total := v_total + v_valor;
  END LOOP;
  IF v_total <= 0 OR v_total > 999999999999.99 THEN
    RAISE EXCEPTION 'Total de recebimento inválido.' USING ERRCODE='22023';
  END IF;

  -- Reutiliza as validações de tenant/permissão e a distribuição financeira.
  v_resultado := public.registrar_recebimento_venda_autorizado(
    p_venda_obra_id => p_venda_obra_id,
    p_cliente_id => p_cliente_id,
    p_valor_recebido => v_total,
    p_desconto => p_desconto,
    p_data_recebimento => p_data_recebimento,
    p_forma => CASE WHEN jsonb_array_length(p_formas) > 1 THEN 'multiplo' ELSE lower(btrim(p_formas->0->>'forma')) END,
    p_referencia => p_referencia,
    p_observacoes => p_observacoes
  );
  IF coalesce((v_resultado->>'ok')::boolean,false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Não foi possível registrar o recebimento.' USING ERRCODE='22023';
  END IF;
  v_recebimento_id := (v_resultado->>'recebimento_id')::uuid;
  IF v_recebimento_id IS NULL THEN
    RAISE EXCEPTION 'Recebimento sem identificação.' USING ERRCODE='22023';
  END IF;
  UPDATE public.financeiro_recebimentos
  SET venda_obra_id = p_venda_obra_id
  WHERE id = v_recebimento_id AND empresa_id = v_empresa_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_formas) LOOP
    v_ordem := v_ordem + 1;
    INSERT INTO public.financeiro_recebimento_formas (empresa_id,recebimento_id,ordem,forma,valor,parcelas)
    VALUES (
      v_empresa_id,v_recebimento_id,v_ordem,
      lower(btrim(v_item.value->>'forma')),(v_item.value->>'valor')::numeric,
      CASE WHEN lower(btrim(v_item.value->>'forma'))='cartao_credito'
        THEN (v_item.value->>'parcelas')::integer ELSE NULL END
    );
  END LOOP;
  RETURN v_resultado || jsonb_build_object('formas',v_ordem);
END;
$function$;
REVOKE ALL ON FUNCTION public.registrar_recebimento_venda_multiforma(uuid,uuid,jsonb,numeric,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_recebimento_venda_multiforma(uuid,uuid,jsonb,numeric,date,text,text) TO authenticated;


-- Liga recebimentos novos à venda para manter o histórico mesmo após estorno
-- e não altera a forma como os lançamentos antigos são calculados.
ALTER TABLE public.financeiro_recebimentos
  ADD COLUMN IF NOT EXISTS venda_obra_id uuid REFERENCES public.vendas_obras(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_financeiro_recebimentos_venda_tenant
  ON public.financeiro_recebimentos(empresa_id,venda_obra_id,created_at DESC)
  WHERE venda_obra_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.financeiro_recebimento_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  venda_obra_id uuid NOT NULL REFERENCES public.vendas_obras(id),
  recebimento_original_id uuid NOT NULL REFERENCES public.financeiro_recebimentos(id),
  recebimento_substituto_id uuid REFERENCES public.financeiro_recebimentos(id),
  acao text NOT NULL CHECK (acao IN ('cancelar','alterar')),
  motivo text NOT NULL CHECK (char_length(trim(motivo)) BETWEEN 8 AND 500),
  antes jsonb NOT NULL,
  depois jsonb NOT NULL,
  usuario_id uuid NOT NULL REFERENCES auth.users(id),
  usuario_nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recebimento_ajustes_venda
  ON public.financeiro_recebimento_ajustes(empresa_id,venda_obra_id,created_at DESC);
ALTER TABLE public.financeiro_recebimento_ajustes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recebimento_ajustes_consulta_financeiro ON public.financeiro_recebimento_ajustes;
CREATE POLICY recebimento_ajustes_consulta_financeiro ON public.financeiro_recebimento_ajustes
  FOR SELECT TO authenticated
  USING (
    empresa_id = (SELECT private.current_empresa_id())
    AND EXISTS (
      SELECT 1 FROM public.usuarios u WHERE u.id = (SELECT auth.uid())
      AND u.empresa_id = financeiro_recebimento_ajustes.empresa_id
      AND (lower(u.role) = 'master' OR EXISTS (
        SELECT 1 FROM public.permissoes p WHERE p.usuario_id = u.id
        AND p.empresa_id = u.empresa_id AND p.setor_id = 'financeiro'
        AND p.nivel = 'edicao'
      ))
    )
  );
REVOKE ALL ON public.financeiro_recebimento_ajustes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.financeiro_recebimento_ajustes TO authenticated;

-- Estorno e eventual substituição são atômicos e exclusivos do Master.
-- O cabeçalho antigo permanece com status cancelado, dados originais intactos
-- e um snapshot de alocações preservado na trilha imutável de auditoria.
CREATE OR REPLACE FUNCTION public.ajustar_recebimento_venda_auditado(
  p_venda_obra_id uuid,
  p_recebimento_id uuid,
  p_acao text,
  p_motivo text,
  p_novas_formas jsonb DEFAULT NULL,
  p_novo_desconto numeric DEFAULT 0,
  p_nova_data date DEFAULT NULL,
  p_nova_referencia text DEFAULT NULL,
  p_novas_observacoes text DEFAULT NULL,
  p_valor_esperado numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public','private','pg_temp'
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
    v_pago := round(coalesce(v_conta.valor_pago,0)-v_item.total_pago,2);
    -- A rotina atual registra o abatimento em valor_desconto, sem reduzir valor.
    -- Estornar o abatimento nunca deve aumentar o preço original da parcela.
    v_conta_valor := round(v_conta.valor,2);
    IF v_pago < 0 OR v_pago + coalesce(v_conta.valor_desconto,0) > v_conta_valor+0.009 THEN
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
    SET valor=v_conta_valor,valor_pago=v_pago,
      status=CASE
        WHEN v_pago+coalesce(valor_desconto,0)>=v_conta_valor-0.009 THEN 'pago'
        WHEN vencimento IS NOT NULL AND vencimento<current_date THEN 'vencido'
        ELSE 'aberto' END,
      data_pagamento=CASE
        WHEN v_pago+coalesce(valor_desconto,0)>=v_conta_valor-0.009
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
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ajustar_recebimento_venda_auditado(uuid,uuid,text,text,jsonb,numeric,date,text,text,numeric)
  TO authenticated;
