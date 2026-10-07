create or replace function public.registrar_recebimento_venda_com_desconto(
  p_venda_obra_id uuid,
  p_cliente_id uuid,
  p_valor_recebido numeric,
  p_desconto numeric default 0,
  p_data_recebimento date default current_date,
  p_forma text default null,
  p_referencia text default null,
  p_observacoes text default null,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_empresa_id uuid := private.current_empresa_id();
  v_venda public.vendas_obras%rowtype;
  v_cliente_nome text;
  v_recebimento public.financeiro_recebimentos%rowtype;
  v_total_saldo numeric := 0;
  v_restante_recebimento numeric := 0;
  v_restante_desconto numeric := 0;
  v_saldo numeric := 0;
  v_aplicar_recebimento numeric := 0;
  v_aplicar_desconto numeric := 0;
  v_novo_pago numeric := 0;
  v_novo_valor numeric := 0;
  c record;
begin
  if v_empresa_id is null then raise exception 'Empresa não identificada.'; end if;
  if p_venda_obra_id is null then raise exception 'Venda é obrigatória.'; end if;
  if p_cliente_id is null then raise exception 'Cliente é obrigatório.'; end if;
  if p_valor_recebido is null or p_valor_recebido <= 0 then raise exception 'Valor recebido deve ser maior que zero.'; end if;
  if coalesce(p_desconto,0) < 0 then raise exception 'Desconto não pode ser negativo.'; end if;

  select *
    into v_venda
    from public.vendas_obras
   where id = p_venda_obra_id
     and cliente_id = p_cliente_id
     and empresa_id = v_empresa_id
   for update;
  if v_venda.id is null then raise exception 'Venda não encontrada para este cliente.'; end if;

  select nome
    into v_cliente_nome
    from public.clientes
   where id = p_cliente_id
     and empresa_id = v_empresa_id;
  if v_cliente_nome is null then raise exception 'Cliente não encontrado.'; end if;

  select coalesce(sum(greatest(0, cr.valor - coalesce(cr.valor_pago,0))),0)
    into v_total_saldo
    from public.financeiro_contas_receber cr
   where cr.venda_obra_id = p_venda_obra_id
     and cr.cliente_id = p_cliente_id
     and cr.empresa_id = v_empresa_id
     and cr.status <> 'cancelado';

  if v_total_saldo <= 0.009 then raise exception 'Esta venda não possui saldo em aberto.'; end if;
  if p_valor_recebido + coalesce(p_desconto,0) > v_total_saldo + 0.009 then
    raise exception 'Recebimento mais desconto excede o saldo em aberto da venda.';
  end if;

  insert into public.financeiro_recebimentos(
    empresa_id, cliente_id, cliente_nome, obra_id, data_recebimento, valor, forma,
    referencia, observacoes, criado_por_id, criado_por_nome
  ) values (
    v_empresa_id, p_cliente_id, v_cliente_nome, v_venda.obra_id,
    coalesce(p_data_recebimento,current_date), p_valor_recebido,
    nullif(trim(coalesce(p_forma,'')),''),
    nullif(trim(coalesce(p_referencia,'')),''),
    nullif(trim(concat_ws(E'\n',
      nullif(trim(coalesce(p_observacoes,'')),''),
      case when coalesce(p_desconto,0) > 0
        then 'Desconto concedido nesta baixa: R$ ' || to_char(p_desconto,'FM999999990D00')
        else null end
    )),''),
    p_usuario_id, p_usuario_nome
  ) returning * into v_recebimento;

  v_restante_recebimento := p_valor_recebido;
  v_restante_desconto := coalesce(p_desconto,0);

  for c in
    select cr.id, cr.obra_id, cr.valor, coalesce(cr.valor_pago,0) as valor_pago, cr.vencimento
      from public.financeiro_contas_receber cr
     where cr.venda_obra_id = p_venda_obra_id
       and cr.cliente_id = p_cliente_id
       and cr.empresa_id = v_empresa_id
       and cr.status <> 'cancelado'
       and cr.valor > coalesce(cr.valor_pago,0)
     order by cr.vencimento nulls last, cr.data_emissao, cr.created_at
     for update
  loop
    exit when v_restante_recebimento <= 0.009 and v_restante_desconto <= 0.009;

    v_saldo := greatest(0, c.valor - c.valor_pago);
    v_aplicar_recebimento := least(v_restante_recebimento, v_saldo);
    v_saldo := v_saldo - v_aplicar_recebimento;
    v_aplicar_desconto := least(v_restante_desconto, v_saldo);

    v_novo_pago := c.valor_pago + v_aplicar_recebimento;
    v_novo_valor := greatest(v_novo_pago, c.valor - v_aplicar_desconto);

    update public.financeiro_contas_receber
       set valor = v_novo_valor,
           valor_pago = v_novo_pago,
           data_pagamento = case when v_novo_pago >= v_novo_valor - 0.009
             then coalesce(p_data_recebimento,current_date) else data_pagamento end,
           forma = case when v_aplicar_recebimento > 0
             then coalesce(nullif(trim(coalesce(p_forma,'')),''),forma) else forma end,
           status = case
             when v_novo_pago >= v_novo_valor - 0.009 then 'pago'
             when c.vencimento is not null and c.vencimento < current_date then 'vencido'
             else 'aberto' end,
           observacoes = case when v_aplicar_desconto > 0 then concat_ws(
             E'\n', observacoes,
             'Desconto de R$ ' || to_char(v_aplicar_desconto,'FM999999990D00') ||
             ' concedido no recebimento de ' || to_char(coalesce(p_data_recebimento,current_date),'DD/MM/YYYY') || '.'
           ) else observacoes end,
           updated_at = now()
     where id = c.id and empresa_id = v_empresa_id;

    if v_aplicar_recebimento > 0.009 then
      insert into public.financeiro_recebimento_alocacoes(
        empresa_id, recebimento_id, conta_receber_id, obra_id, tipo, valor, criado_por_id, criado_por_nome
      ) values (
        v_empresa_id, v_recebimento.id, c.id, c.obra_id, 'conta',
        v_aplicar_recebimento, p_usuario_id, p_usuario_nome
      );
    end if;

    if v_aplicar_desconto > 0.009 then
      insert into public.financeiro_recebimento_alocacoes(
        empresa_id, recebimento_id, conta_receber_id, obra_id, tipo, valor, criado_por_id, criado_por_nome
      ) values (
        v_empresa_id, v_recebimento.id, c.id, c.obra_id, 'desconto',
        v_aplicar_desconto, p_usuario_id, p_usuario_nome
      );
    end if;

    v_restante_recebimento := v_restante_recebimento - v_aplicar_recebimento;
    v_restante_desconto := v_restante_desconto - v_aplicar_desconto;
  end loop;

  if v_restante_recebimento > 0.009 or v_restante_desconto > 0.009 then
    raise exception 'Não foi possível distribuir integralmente o recebimento e o desconto.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'recebimento_id', v_recebimento.id,
    'venda_obra_id', p_venda_obra_id,
    'valor_recebido', p_valor_recebido,
    'desconto', coalesce(p_desconto,0),
    'total_baixado', p_valor_recebido + coalesce(p_desconto,0),
    'saldo_anterior', v_total_saldo,
    'saldo_restante', greatest(0, v_total_saldo - p_valor_recebido - coalesce(p_desconto,0))
  );
end;
$function$;

grant execute on function public.registrar_recebimento_venda_com_desconto(
  uuid,uuid,numeric,numeric,date,text,text,text,uuid,text
) to authenticated;
