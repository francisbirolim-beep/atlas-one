create or replace function public.baixar_conta_receber_balcao(
  p_conta_id uuid,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_forma text,
  p_valor numeric,
  p_caixa_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_empresa uuid;
  c public.financeiro_contas_receber%rowtype;
  cx public.balcao_caixas%rowtype;
  v_forma text := lower(trim(coalesce(p_forma,'')));
begin
  select empresa_id into v_empresa from public.usuarios where id=p_usuario_id;
  if v_empresa is null then raise exception 'Usuário sem empresa válida'; end if;

  select * into c from public.financeiro_contas_receber
   where id=p_conta_id and empresa_id=v_empresa
   for update;
  if c.id is null then raise exception 'Conta não encontrada para esta empresa.'; end if;
  if c.status='pago' then raise exception 'Conta já está paga.'; end if;
  if c.status='cancelado' then raise exception 'Conta cancelada não pode ser recebida.'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Valor recebido inválido.'; end if;
  if abs(p_valor-c.valor) > 0.01 then raise exception 'Esta versão exige baixa integral da parcela. Valor esperado: %.', c.valor; end if;
  if v_forma not in ('dinheiro','pix','cartao_debito','cartao_credito','outros') then raise exception 'Forma de recebimento inválida.'; end if;
  if p_caixa_id is null then raise exception 'Abra o caixa antes de receber a parcela.'; end if;

  select * into cx from public.balcao_caixas
   where id=p_caixa_id and empresa_id=v_empresa
   for update;
  if cx.id is null or cx.status<>'aberto' then raise exception 'Caixa não está aberto para esta empresa.'; end if;
  if cx.operador_id<>p_usuario_id then raise exception 'Este caixa pertence a outro operador.'; end if;

  update public.financeiro_contas_receber
     set status='pago',data_pagamento=current_date,valor_pago=p_valor,forma=v_forma,updated_at=now()
   where id=p_conta_id and empresa_id=v_empresa;

  insert into public.balcao_caixa_movimentos(
    caixa_id,venda_id,tipo,forma_pagamento,entrada,saida,descricao,criado_por_id,criado_por_nome,empresa_id
  ) values(
    p_caixa_id,c.venda_balcao_id,'recebimento',v_forma,p_valor,0,
    'Recebimento '||coalesce(c.documento,'')||' parcela '||c.parcela||'/'||c.total_parcelas,
    p_usuario_id,p_usuario_nome,v_empresa
  );

  return jsonb_build_object('ok',true,'contaId',c.id,'valor',p_valor);
end;
$$;

revoke all on function public.baixar_conta_receber_balcao(uuid,uuid,text,text,numeric,uuid) from public,anon,authenticated;
grant execute on function public.baixar_conta_receber_balcao(uuid,uuid,text,text,numeric,uuid) to service_role;
