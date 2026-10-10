create or replace function public.registrar_recebimento_cliente_parcelas(
  p_cliente_id uuid,
  p_cliente_nome text,
  p_data_recebimento date,
  p_forma text,
  p_referencia text,
  p_observacoes text,
  p_alocacoes jsonb,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_recebimento public.financeiro_recebimentos%rowtype;
  v_total numeric := 0;
  v_obra_id uuid := null;
  v_qtd_obras integer := 0;
  v_qtd_contas integer := 0;
  v_resultado jsonb;
begin
  if p_cliente_id is null then raise exception 'Cliente é obrigatório.'; end if;
  if p_alocacoes is null or jsonb_typeof(p_alocacoes) <> 'array' or jsonb_array_length(p_alocacoes) = 0 then
    raise exception 'Selecione ao menos uma parcela.';
  end if;

  if not exists (select 1 from public.clientes c where c.id = p_cliente_id) then
    raise exception 'Cliente não encontrado.';
  end if;

  with itens as (
    select conta_receber_id, sum(valor) valor
    from jsonb_to_recordset(p_alocacoes) as j(conta_receber_id uuid, valor numeric)
    group by conta_receber_id
  )
  select coalesce(sum(i.valor),0), count(*)
  into v_total, v_qtd_contas
  from itens i;

  if v_qtd_contas = 0 or v_total <= 0 then raise exception 'Valor do recebimento deve ser maior que zero.'; end if;

  if exists (
    select 1
    from (
      select conta_receber_id, sum(valor) valor
      from jsonb_to_recordset(p_alocacoes) as j(conta_receber_id uuid, valor numeric)
      group by conta_receber_id
    ) i
    left join public.financeiro_contas_receber cr on cr.id = i.conta_receber_id
    where cr.id is null
       or cr.cliente_id is distinct from p_cliente_id
       or cr.status = 'cancelado'
       or i.valor is null
       or i.valor <= 0
       or i.valor > greatest(0, cr.valor - coalesce(cr.valor_pago,0)) + 0.009
  ) then
    raise exception 'Uma ou mais parcelas são inválidas ou o valor excede o saldo.';
  end if;

  select count(distinct cr.obra_id), (array_agg(distinct cr.obra_id))[1]
  into v_qtd_obras, v_obra_id
  from (
    select conta_receber_id
    from jsonb_to_recordset(p_alocacoes) as j(conta_receber_id uuid, valor numeric)
    group by conta_receber_id
  ) i
  join public.financeiro_contas_receber cr on cr.id = i.conta_receber_id
  where cr.obra_id is not null;

  if v_qtd_obras <> 1 then v_obra_id := null; end if;

  insert into public.financeiro_recebimentos(
    cliente_id, cliente_nome, obra_id, data_recebimento, valor, forma,
    referencia, observacoes, criado_por_id, criado_por_nome
  ) values (
    p_cliente_id,
    coalesce(nullif(trim(p_cliente_nome),''), (select nome from public.clientes where id = p_cliente_id)),
    v_obra_id,
    coalesce(p_data_recebimento, current_date),
    v_total,
    nullif(trim(p_forma),''),
    nullif(trim(p_referencia),''),
    nullif(trim(p_observacoes),''),
    p_usuario_id,
    p_usuario_nome
  ) returning * into v_recebimento;

  v_resultado := public.alocar_recebimento_cliente_em_parcelas(
    v_recebimento.id,
    p_alocacoes,
    p_usuario_id,
    p_usuario_nome
  );

  return jsonb_build_object(
    'ok', true,
    'recebimento_id', v_recebimento.id,
    'valor', v_total,
    'parcelas', v_qtd_contas,
    'obra_id', v_obra_id,
    'alocacao', v_resultado
  );
end;
$$;

revoke execute on function public.registrar_recebimento_cliente_parcelas(uuid,text,date,text,text,text,jsonb,uuid,text) from public, anon;
grant execute on function public.registrar_recebimento_cliente_parcelas(uuid,text,date,text,text,text,jsonb,uuid,text) to authenticated;
