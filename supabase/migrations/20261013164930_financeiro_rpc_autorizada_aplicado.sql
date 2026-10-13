-- A RPC antiga continua restrita: evita executar uma função SECURITY DEFINER
-- financeira sem autorização operacional e evita falsificação de autoria.
-- A função nova exige autenticação e permissão explícita de recebimento.
INSERT INTO public.setores (id,nome,grupo,ordem,ativo,rota,descricao)
VALUES (
  'recebimento-vendas',
  'Registrar recebimentos de vendas',
  'Administrativo',
  48,
  true,
  null,
  'Autoriza registrar baixas e descontos em vendas no Cliente 360, sem acesso irrestrito aos demais módulos financeiros.'
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.registrar_recebimento_venda_autorizado(
  p_venda_obra_id uuid,
  p_cliente_id uuid,
  p_valor_recebido numeric,
  p_desconto numeric DEFAULT 0,
  p_data_recebimento date DEFAULT current_date,
  p_forma text DEFAULT NULL,
  p_referencia text DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_empresa_id uuid := private.current_empresa_id();
  v_nome text;
  v_role text;
BEGIN
  IF v_usuario_id IS NULL OR v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida. Entre novamente no Atlas.' USING ERRCODE='42501';
  END IF;

  SELECT u.nome,u.role INTO v_nome,v_role
  FROM public.usuarios u
  WHERE u.id=v_usuario_id AND u.empresa_id=v_empresa_id;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Funcionário não identificado nesta empresa.' USING ERRCODE='42501';
  END IF;

  IF v_role <> 'master' AND NOT EXISTS (
    SELECT 1 FROM public.permissoes p
    WHERE p.empresa_id=v_empresa_id
      AND p.usuario_id=v_usuario_id
      AND p.nivel='edicao'
      AND p.setor_id IN ('recebimento-vendas','financeiro')
  ) THEN
    RAISE EXCEPTION 'Seu usuário não está autorizado a registrar recebimentos de vendas. Solicite liberação ao Master.' USING ERRCODE='42501';
  END IF;

  -- Isolamento de tenant e vínculo exato com o cliente antes de tocar no financeiro.
  IF NOT EXISTS (
    SELECT 1 FROM public.vendas_obras v
    WHERE v.id=p_venda_obra_id
      AND v.cliente_id=p_cliente_id
      AND v.empresa_id=v_empresa_id
  ) THEN
    RAISE EXCEPTION 'Venda não encontrada para este cliente e empresa.' USING ERRCODE='22023';
  END IF;

  -- A rotina legada continua exclusivamente para chamadas privilegiadas;
  -- autoria vem da sessão, jamais de parâmetros manipuláveis pelo navegador.
  RETURN public.registrar_recebimento_venda_com_desconto(
    p_venda_obra_id => p_venda_obra_id,
    p_cliente_id => p_cliente_id,
    p_valor_recebido => p_valor_recebido,
    p_desconto => p_desconto,
    p_data_recebimento => p_data_recebimento,
    p_forma => p_forma,
    p_referencia => p_referencia,
    p_observacoes => p_observacoes,
    p_usuario_id => v_usuario_id,
    p_usuario_nome => v_nome
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_recebimento_venda_autorizado(
  uuid,uuid,numeric,numeric,date,text,text,text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_recebimento_venda_autorizado(
  uuid,uuid,numeric,numeric,date,text,text,text
) TO authenticated;
-- Preservar explicitamente o bloqueio anterior.
REVOKE ALL ON FUNCTION public.registrar_recebimento_venda_com_desconto(
  uuid,uuid,numeric,numeric,date,text,text,text,uuid,text
) FROM PUBLIC, anon, authenticated;
