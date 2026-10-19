-- Atlas One: recebimento no Caixa e Cliente com a mesma baixa financeira.
-- Aditivo: não altera funções e fluxos já homologados.
-- Não aplicar em produção sem testar em ambiente isolado.
create or replace function public.registrar_recebimento_cliente_caixa_v1(
  p_cliente_id uuid,
  p_cliente_nome text,
  p_data_recebimento date,
  p_forma text,
  p_referencia text,
  p_observacoes text,
  p_alocacoes jsonb,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_caixa_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_empresa uuid;
  v_caixa public.balcao_caixas%rowtype;
  v_resultado jsonb;
  v_recebimento_id uuid;
  v_total_movimentos numeric := 0;
  v_item record;
begin
  select empresa_id into v_empresa
    from public.usuarios where id = p_usuario_id;
  if v_empresa is null then raise exception 'Usuário não pertence a empresa.'; end if;
  if p_cliente_id is null
     or not exists (select 1 from public.clientes where id=p_cliente_id and empresa_id=v_empresa)
    then raise exception 'Cliente inválido para esta empresa.'; end if;
  if p_caixa_id is null then raise exception 'Caixa aberto obrigatório.'; end if;

  select * into v_caixa
    from public.balcao_caixas
   where id=p_caixa_id and empresa_id=v_empresa
   for update;
  if v_caixa.id is null or v_caixa.status<>'aberto'
     or v_caixa.operador_id is distinct from p_usuario_id
     then raise exception 'Caixa fechado ou pertencente a outro operador.'; end if;

  if lower(coalesce(trim(p_forma),'')) not in
    ('pix','dinheiro','boleto','cartao','cartao_debito','cartao_credito','transferencia','cheque','outro','outros')
    then raise exception 'Forma de pagamento inválida.'; end if;
  if p_alocacoes is null or jsonb_typeof(p_alocacoes)<>'array'
     or jsonb_array_length(p_alocacoes)=0 or jsonb_array_length(p_alocacoes)>100
    then raise exception 'Informe de 1 a 100 parcelas.'; end if;

  -- Ao usar service_role não há auth.uid() na sessão PostgREST.
  -- Os triggers/defaults de tenant dependem do usuário do Atlas; definimos
  -- a identidade autenticada SOMENTE nesta transação e após validar empresa,
  -- cliente e caixa aberto. Não concede SQL público a usuários anônimos.
  perform set_config('request.jwt.claim.sub',p_usuario_id::text,true);
  if private.current_empresa_id() is distinct from v_empresa then
    raise exception 'Contexto de empresa inconsistente.';
  end if;

  -- A baixa e o movimento do caixa fazem parte da MESMA transação RPC.
  -- Qualquer erro abaixo desfaz tudo, inclusive o recebimento financeiro.
  v_resultado := public.registrar_recebimento_cliente_parcelas(
    p_cliente_id, p_cliente_nome, p_data_recebimento, p_forma,
    p_referencia, p_observacoes, p_alocacoes,
    p_usuario_id, p_usuario_nome
  );
  v_recebimento_id := (v_resultado->>'recebimento_id')::uuid;
  if not exists (
    select 1 from public.financeiro_recebimentos
     where id=v_recebimento_id and empresa_id=v_empresa and cliente_id=p_cliente_id
  ) then
    raise exception 'Recebimento financeiro inválido para o Caixa.';
  end if;

  for v_item in
    select c.id as conta_id, c.venda_balcao_id, c.documento,
           c.parcela, c.total_parcelas, a.valor
    from (
      select conta_receber_id, sum(valor) as valor
        from jsonb_to_recordset(p_alocacoes) as x(conta_receber_id uuid, valor numeric)
       group by conta_receber_id
    ) a
    join public.financeiro_contas_receber c on c.id=a.conta_receber_id
     and c.empresa_id=v_empresa and c.cliente_id=p_cliente_id
  loop
    if v_item.valor<=0 then raise exception 'Valor inválido no Caixa.'; end if;
    insert into public.balcao_caixa_movimentos (
      caixa_id, venda_id, tipo, forma_pagamento, entrada, saida,
      descricao, criado_por_id, criado_por_nome, empresa_id
    ) values (
      v_caixa.id, v_item.venda_balcao_id, 'recebimento',
      lower(trim(p_forma)), v_item.valor, 0,
      'Recebimento Atlas '||v_recebimento_id::text||' - '||
        coalesce(v_item.documento,'Parcela')||' '||
        coalesce(v_item.parcela::text,'1')||'/'||
        coalesce(v_item.total_parcelas::text,'1'),
      p_usuario_id, p_usuario_nome, v_empresa
    );
    v_total_movimentos := v_total_movimentos+v_item.valor;
  end loop;

  if abs(v_total_movimentos-coalesce((v_resultado->>'valor')::numeric,0))>0.009
    then raise exception 'Divergência entre recebimento e caixa, operação revertida.'; end if;
  return v_resultado || jsonb_build_object(
    'caixa_id',v_caixa.id,'movimentos_caixa',v_total_movimentos,'origem','caixa'
  );
end;
$$;
revoke all on function public.registrar_recebimento_cliente_caixa_v1(uuid,text,date,text,text,text,jsonb,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.registrar_recebimento_cliente_caixa_v1(uuid,text,date,text,text,text,jsonb,uuid,text,uuid) to service_role;

-- Cliente 360 usa a mesma rotina de parcelas, mas sem movimento de caixa;
-- o Caixa acrescenta esse movimento na função acima, atomicamente.
create or replace function public.registrar_recebimento_cliente_servidor_v1(
  p_cliente_id uuid,
  p_cliente_nome text,
  p_data_recebimento date,
  p_forma text,
  p_referencia text,
  p_observacoes text,
  p_alocacoes jsonb,
  p_usuario_id uuid,
  p_usuario_nome text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.usuarios where id=p_usuario_id;
  if v_empresa is null or p_cliente_id is null or not exists (
    select 1 from public.clientes where id=p_cliente_id and empresa_id=v_empresa
  ) then raise exception 'Cliente ou operador fora do escopo da empresa.'; end if;
  perform set_config('request.jwt.claim.sub',p_usuario_id::text,true);
  if private.current_empresa_id() is distinct from v_empresa then
    raise exception 'Contexto de empresa inconsistente.';
  end if;
  return public.registrar_recebimento_cliente_parcelas(
    p_cliente_id,p_cliente_nome,p_data_recebimento,p_forma,
    p_referencia,p_observacoes,p_alocacoes,p_usuario_id,p_usuario_nome
  );
end;
$$;
revoke all on function public.registrar_recebimento_cliente_servidor_v1(uuid,text,date,text,text,text,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.registrar_recebimento_cliente_servidor_v1(uuid,text,date,text,text,text,jsonb,uuid,text) to service_role;
