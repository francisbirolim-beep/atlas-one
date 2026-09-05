create or replace function public.alocar_recebimento_cliente_em_parcelas(
  p_recebimento_id uuid,
  p_alocacoes jsonb,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  r public.financeiro_recebimentos%rowtype;
  a record;
  c public.financeiro_contas_receber%rowtype;
  v_total_alocado numeric := 0;
  v_disponivel numeric := 0;
  v_total_solicitado numeric := 0;
  v_saldo_conta numeric := 0;
  v_novo_pago numeric := 0;
begin
  if p_alocacoes is null or jsonb_typeof(p_alocacoes) <> 'array' or jsonb_array_length(p_alocacoes) = 0 then
    raise exception 'Informe ao menos uma parcela para receber.';
  end if;

  select * into r
  from public.financeiro_recebimentos
  where id = p_recebimento_id
  for update;

  if r.id is null then raise exception 'Recebimento não encontrado.'; end if;
  if r.status = 'cancelado' then raise exception 'Recebimento cancelado não pode ser alocado.'; end if;

  select coalesce(sum(x.valor), 0) into v_total_alocado
  from public.financeiro_recebimento_alocacoes x
  where x.recebimento_id = r.id;

  v_disponivel := r.valor - v_total_alocado;

  select coalesce(sum(z.valor), 0) into v_total_solicitado
  from (
    select conta_receber_id, sum(valor) valor
    from jsonb_to_recordset(p_alocacoes) as j(conta_receber_id uuid, valor numeric)
    group by conta_receber_id
  ) z;

  if v_total_solicitado <= 0 then
    raise exception 'O valor total das parcelas deve ser maior que zero.';
  end if;

  if v_total_solicitado > v_disponivel + 0.009 then
    raise exception 'Valor das parcelas maior que o saldo disponível do recebimento.';
  end if;

  for a in
    select conta_receber_id, sum(valor) valor
    from jsonb_to_recordset(p_alocacoes) as j(conta_receber_id uuid, valor numeric)
    group by conta_receber_id
  loop
    if a.conta_receber_id is null or a.valor is null or a.valor <= 0 then
      raise exception 'Parcela ou valor inválido na distribuição.';
    end if;

    select * into c
    from public.financeiro_contas_receber
    where id = a.conta_receber_id
    for update;

    if c.id is null then raise exception 'Parcela não encontrada.'; end if;
    if c.cliente_id is distinct from r.cliente_id then raise exception 'A parcela não pertence a este cliente.'; end if;
    if c.status = 'cancelado' then raise exception 'Parcela cancelada não pode receber pagamento.'; end if;
    if r.obra_id is not null and c.obra_id is distinct from r.obra_id then
      raise exception 'A parcela não pertence à obra vinculada ao recebimento.';
    end if;

    v_saldo_conta := greatest(0, c.valor - coalesce(c.valor_pago, 0));
    if a.valor > v_saldo_conta + 0.009 then
      raise exception 'Valor informado excede o saldo da parcela %.', coalesce(c.documento, c.id::text);
    end if;

    v_novo_pago := coalesce(c.valor_pago, 0) + a.valor;

    update public.financeiro_contas_receber
    set valor_pago = v_novo_pago,
        data_pagamento = case when v_novo_pago >= c.valor - 0.009 then r.data_recebimento else data_pagamento end,
        forma = coalesce(r.forma, forma),
        status = case when v_novo_pago >= c.valor - 0.009 then 'pago' else 'aberto' end,
        updated_at = now()
    where id = c.id;

    insert into public.financeiro_recebimento_alocacoes(
      recebimento_id, conta_receber_id, obra_id, tipo, valor, criado_por_id, criado_por_nome
    ) values (
      r.id, c.id, c.obra_id, 'conta', a.valor, p_usuario_id, p_usuario_nome
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'recebimento_id', r.id,
    'valor_alocado', v_total_solicitado,
    'saldo_recebimento', greatest(0, v_disponivel - v_total_solicitado)
  );
end;
$$;

revoke execute on function public.alocar_recebimento_cliente_em_parcelas(uuid,jsonb,uuid,text) from public, anon;
grant execute on function public.alocar_recebimento_cliente_em_parcelas(uuid,jsonb,uuid,text) to authenticated;
