create or replace function public.alocar_recebimento_cliente_em_obra(
  p_recebimento_id uuid,
  p_obra_id uuid,
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
  o public.obras%rowtype;
  c record;
  v_total_alocado numeric := 0;
  v_disponivel numeric := 0;
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

  select * into o from public.obras where id = p_obra_id;
  if o.id is null then raise exception 'Obra não encontrada.'; end if;
  if o.cliente_id <> r.cliente_id then raise exception 'A obra não pertence a este cliente.'; end if;

  if r.obra_id is not null and r.obra_id <> p_obra_id then
    raise exception 'Este recebimento foi registrado diretamente em outra obra.';
  end if;

  select coalesce(sum(a.valor),0) into v_total_alocado
  from public.financeiro_recebimento_alocacoes a
  where a.recebimento_id = r.id;

  v_disponivel := r.valor - v_total_alocado;
  if p_valor > v_disponivel + 0.009 then
    raise exception 'Valor maior que o saldo disponível do recebimento.';
  end if;

  v_restante := p_valor;

  for c in
    select cr.id, cr.valor, coalesce(cr.valor_pago,0) valor_pago
    from public.financeiro_contas_receber cr
    where cr.cliente_id = r.cliente_id
      and cr.obra_id = p_obra_id
      and cr.status not in ('pago','cancelado')
      and cr.valor > coalesce(cr.valor_pago,0)
    order by cr.vencimento nulls last, cr.data_emissao, cr.created_at
    for update
  loop
    exit when v_restante <= 0.009;
    v_saldo_conta := c.valor - c.valor_pago;
    v_aplicar := least(v_restante, v_saldo_conta);

    update public.financeiro_contas_receber
    set valor_pago = coalesce(valor_pago,0) + v_aplicar,
        data_pagamento = case when coalesce(valor_pago,0) + v_aplicar >= valor - 0.009 then r.data_recebimento else data_pagamento end,
        forma = coalesce(r.forma, forma),
        -- O financeiro legado só aceita aberto/pago/cancelado/vencido.
        -- Parcela parcialmente recebida continua aberta e o saldo é controlado por valor_pago.
        status = case when coalesce(valor_pago,0) + v_aplicar >= valor - 0.009 then 'pago' else 'aberto' end,
        updated_at = now()
    where id = c.id;

    insert into public.financeiro_recebimento_alocacoes(
      recebimento_id, conta_receber_id, obra_id, tipo, valor, criado_por_id, criado_por_nome
    ) values (
      r.id, c.id, p_obra_id, 'conta', v_aplicar, p_usuario_id, p_usuario_nome
    );

    v_restante := v_restante - v_aplicar;
  end loop;

  if v_restante > 0.009 then
    insert into public.financeiro_recebimento_alocacoes(
      recebimento_id, conta_receber_id, obra_id, tipo, valor, criado_por_id, criado_por_nome
    ) values (
      r.id, null, p_obra_id, 'credito_obra', v_restante, p_usuario_id, p_usuario_nome
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'recebimento_id', r.id,
    'obra_id', p_obra_id,
    'valor_alocado', p_valor,
    'credito_obra', greatest(v_restante,0)
  );
end;
$$;

grant execute on function public.alocar_recebimento_cliente_em_obra(uuid,uuid,numeric,uuid,text) to anon, authenticated;
