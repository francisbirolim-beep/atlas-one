[Reading 97 lines from start (total: 97 lines, 0 remaining)]

create or replace function public.alocar_recebimento_cliente_em_venda(
  p_recebimento_id uuid,
  p_venda_obra_id uuid,
  p_valor numeric,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  r public.financeiro_recebimentos%rowtype;
  v public.vendas_obras%rowtype;
  c record;
  v_total_alocado numeric := 0;
  v_disponivel numeric := 0;
  v_saldo_venda numeric := 0;
  v_restante numeric := 0;
  v_saldo_conta numeric := 0;
  v_aplicar numeric := 0;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor para alocação deve ser maior que zero.';
  end if;

  select * into r from public.financeiro_recebimentos where id = p_recebimento_id for update;
  if r.id is null then raise exception 'Recebimento não encontrado.'; end if;
  if r.status = 'cancelado' then raise exception 'Recebimento cancelado não pode ser alocado.'; end if;

  select * into v from public.vendas_obras where id = p_venda_obra_id;
  if v.id is null then raise exception 'Venda não encontrada.'; end if;
  if v.cliente_id <> r.cliente_id then raise exception 'A venda não pertence a este cliente.'; end if;

  select coalesce(sum(a.valor),0) into v_total_alocado
  from public.financeiro_recebimento_alocacoes a
  where a.recebimento_id = r.id;

  v_disponivel := r.valor - v_total_alocado;
  if p_valor > v_disponivel + 0.009 then
    raise exception 'Valor maior que o saldo disponível do recebimento.';
  end if;

  select coalesce(sum(greatest(0,cr.valor-coalesce(cr.valor_pago,0)-coalesce(cr.valor_desconto,0))),0)
  into v_saldo_venda
  from public.financeiro_contas_receber cr
  where cr.venda_obra_id = p_venda_obra_id
    and cr.status not in ('pago','cancelado');

  if p_valor > v_saldo_venda + 0.009 then
    raise exception 'Valor maior que o saldo desta venda.';
  end if;

  v_restante := p_valor;

  for c in
    select cr.id, cr.valor, coalesce(cr.valor_pago,0) valor_pago, coalesce(cr.valor_desconto,0) valor_desconto
    from public.financeiro_contas_receber cr
    where cr.venda_obra_id = p_venda_obra_id
      and cr.status not in ('pago','cancelado')
      and cr.valor > coalesce(cr.valor_pago,0) + coalesce(cr.valor_desconto,0)
    order by cr.vencimento nulls last, cr.data_emissao, cr.created_at
    for update
  loop
    exit when v_restante <= 0.009;
    v_saldo_conta := c.valor - c.valor_pago - c.valor_desconto;
    v_aplicar := least(v_restante, v_saldo_conta);

    update public.financeiro_contas_receber
    set valor_pago = coalesce(valor_pago,0) + v_aplicar,
        data_pagamento = case when coalesce(valor_pago,0) + coalesce(valor_desconto,0) + v_aplicar >= valor - 0.009 then r.data_recebimento else data_pagamento end,
        forma = coalesce(r.forma, forma),
        status = case when coalesce(valor_pago,0) + coalesce(valor_desconto,0) + v_aplicar >= valor - 0.009 then 'pago' else 'aberto' end,
        updated_at = now()
    where id = c.id;

    insert into public.financeiro_recebimento_alocacoes(
      recebimento_id, conta_receber_id, obra_id, tipo, valor, criado_por_id, criado_por_nome
    ) values (
      r.id, c.id, v.obra_id, 'conta', v_aplicar, p_usuario_id, p_usuario_nome
    );

    v_restante := v_restante - v_aplicar;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'recebimento_id', r.id,
    'venda_obra_id', v.id,
    'valor_alocado', p_valor,
    'restante', greatest(v_restante,0)
  );
end;
$$;

grant execute on function public.alocar_recebimento_cliente_em_venda(uuid,uuid,numeric,uuid,text) to authenticated;
revoke execute on function public.alocar_recebimento_cliente_em_venda(uuid,uuid,numeric,uuid,text) from public, anon;

[executed on device: MacBook-Air-de-Francis.local (d826e938-c59b-466a-8dd2-7429b4a59e10)]