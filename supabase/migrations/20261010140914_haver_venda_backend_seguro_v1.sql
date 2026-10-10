revoke all on function public.aplicar_haver_cliente_venda_v1(uuid,uuid,numeric,text) from public,anon,authenticated;
grant execute on function public.aplicar_haver_cliente_venda_v1(uuid,uuid,numeric,text) to service_role;

create or replace function public.aplicar_haver_cliente_venda_backend_v1(
  p_recebimento_id uuid,
  p_venda_obra_id uuid,
  p_valor numeric,
  p_usuario_id uuid,
  p_usuario_nome text default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_empresa uuid;
  v_recebimento public.financeiro_recebimentos%rowtype;
  v_venda public.vendas_obras%rowtype;
  v_total_alocado numeric := 0;
  v_disponivel numeric := 0;
  v_restante numeric := 0;
  v_aplicar numeric := 0;
  v_saldo numeric := 0;
  v_aplicado numeric := 0;
  c record;
begin
  if p_usuario_id is null then raise exception 'Usuário não informado'; end if;
  select empresa_id into v_empresa from public.usuarios where id=p_usuario_id;
  if v_empresa is null then raise exception 'Usuário sem empresa vinculada'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Valor deve ser maior que zero'; end if;

  select * into v_recebimento
  from public.financeiro_recebimentos
  where id=p_recebimento_id and empresa_id=v_empresa
  for update;
  if not found then raise exception 'Recebimento não encontrado'; end if;
  if v_recebimento.status='cancelado' then raise exception 'Recebimento cancelado não pode ser usado como haver'; end if;
  if v_recebimento.obra_id is not null then raise exception 'Somente haver geral não alocado pode ser aplicado por esta ação'; end if;

  select * into v_venda
  from public.vendas_obras
  where id=p_venda_obra_id and empresa_id=v_empresa
  for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  if v_venda.cliente_id <> v_recebimento.cliente_id then raise exception 'O haver não pertence ao cliente desta venda'; end if;

  select coalesce(sum(a.valor),0) into v_total_alocado
  from public.financeiro_recebimento_alocacoes a
  where a.recebimento_id=v_recebimento.id and a.empresa_id=v_empresa;
  v_disponivel := greatest(0,v_recebimento.valor-v_total_alocado);
  if p_valor > v_disponivel + 0.009 then raise exception 'Valor maior que o haver disponível'; end if;

  select coalesce(sum(greatest(0,cr.valor-coalesce(cr.valor_pago,0)-coalesce(cr.valor_desconto,0))),0)
  into v_saldo
  from public.financeiro_contas_receber cr
  where cr.venda_obra_id=v_venda.id and cr.empresa_id=v_empresa and cr.status not in ('pago','cancelado');
  if p_valor > v_saldo + 0.009 then raise exception 'Valor maior que o saldo desta venda'; end if;

  v_restante := p_valor;
  for c in
    select cr.id,cr.valor,coalesce(cr.valor_pago,0) valor_pago,coalesce(cr.valor_desconto,0) valor_desconto
    from public.financeiro_contas_receber cr
    where cr.venda_obra_id=v_venda.id
      and cr.empresa_id=v_empresa
      and cr.status not in ('pago','cancelado')
      and cr.valor > coalesce(cr.valor_pago,0)+coalesce(cr.valor_desconto,0)
    order by cr.vencimento nulls last,cr.created_at
    for update
  loop
    exit when v_restante <= 0.009;
    v_saldo := greatest(0,c.valor-c.valor_pago-c.valor_desconto);
    v_aplicar := least(v_restante,v_saldo);

    update public.financeiro_contas_receber
    set valor_pago=coalesce(valor_pago,0)+v_aplicar,
        data_pagamento=case when coalesce(valor_pago,0)+coalesce(valor_desconto,0)+v_aplicar >= valor-0.009 then v_recebimento.data_recebimento else data_pagamento end,
        forma=coalesce(v_recebimento.forma,forma),
        status=case when coalesce(valor_pago,0)+coalesce(valor_desconto,0)+v_aplicar >= valor-0.009 then 'pago' else 'aberto' end,
        updated_at=now()
    where id=c.id and empresa_id=v_empresa;

    insert into public.financeiro_recebimento_alocacoes(
      empresa_id,recebimento_id,conta_receber_id,obra_id,tipo,valor,criado_por_id,criado_por_nome
    ) values (
      v_empresa,v_recebimento.id,c.id,v_venda.obra_id,'conta',v_aplicar,p_usuario_id,p_usuario_nome
    );

    v_restante := v_restante-v_aplicar;
    v_aplicado := v_aplicado+v_aplicar;
  end loop;

  if v_restante > 0.009 then raise exception 'Não foi possível aplicar todo o valor solicitado'; end if;

  return jsonb_build_object(
    'ok',true,
    'recebimento_id',v_recebimento.id,
    'venda_obra_id',v_venda.id,
    'valor_aplicado',v_aplicado,
    'saldo_haver',greatest(0,v_disponivel-v_aplicado)
  );
end;
$$;

revoke all on function public.aplicar_haver_cliente_venda_backend_v1(uuid,uuid,numeric,uuid,text) from public,anon,authenticated;
grant execute on function public.aplicar_haver_cliente_venda_backend_v1(uuid,uuid,numeric,uuid,text) to service_role;