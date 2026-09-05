alter table public.balcao_vendas alter column empresa_id set not null;
alter table public.balcao_venda_itens alter column empresa_id set not null;
alter table public.balcao_venda_eventos alter column empresa_id set not null;
alter table public.balcao_venda_evento_itens alter column empresa_id set not null;
alter table public.balcao_caixas alter column empresa_id set not null;
alter table public.balcao_caixa_movimentos alter column empresa_id set not null;
alter table public.balcao_pontos_caixa alter column empresa_id set not null;
alter table public.estoque_locais alter column empresa_id set not null;

create or replace function public.concluir_reembolso_balcao(
  p_evento_id uuid,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_movimentar_caixa boolean default false,
  p_caixa_id uuid default null,
  p_observacoes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_empresa uuid;
  v_evento public.balcao_venda_eventos%rowtype;
  v_venda public.balcao_vendas%rowtype;
  v_caixa public.balcao_caixas%rowtype;
  v_novo_id uuid;
begin
  select empresa_id into v_empresa from public.usuarios where id=p_usuario_id;
  if v_empresa is null then raise exception 'Usuário sem empresa válida'; end if;

  select * into v_evento from public.balcao_venda_eventos
   where id=p_evento_id and empresa_id=v_empresa for update;
  if v_evento.id is null or v_evento.tipo<>'reembolso_pendente' then raise exception 'Reembolso pendente não encontrado para esta empresa.'; end if;
  if v_evento.status<>'pendente' then raise exception 'Este reembolso já foi concluído ou cancelado.'; end if;

  select * into v_venda from public.balcao_vendas where id=v_evento.venda_id and empresa_id=v_empresa;
  if v_venda.id is null then raise exception 'Venda não encontrada para esta empresa.'; end if;

  if p_movimentar_caixa then
    if p_caixa_id is null then raise exception 'Informe o caixa.'; end if;
    select * into v_caixa from public.balcao_caixas where id=p_caixa_id and empresa_id=v_empresa for update;
    if v_caixa.id is null or v_caixa.status<>'aberto' then raise exception 'Caixa informado não está aberto para esta empresa.'; end if;
    insert into public.balcao_caixa_movimentos(caixa_id,venda_id,tipo,forma_pagamento,saida,descricao,criado_por_id,criado_por_nome,empresa_id)
    values(p_caixa_id,v_evento.venda_id,'estorno','reembolso',v_evento.valor,'Conclusão de reembolso da venda balcão #'||v_venda.numero,p_usuario_id,p_usuario_nome,v_empresa);
  end if;

  update public.balcao_venda_eventos
     set status='concluido',concluido_em=now(),observacoes=concat_ws(E'\n',observacoes,nullif(trim(coalesce(p_observacoes,'')),''))
   where id=p_evento_id and empresa_id=v_empresa;

  insert into public.balcao_venda_eventos(venda_id,tipo,status,motivo,observacoes,valor,usuario_id,usuario_nome,dados,concluido_em,empresa_id)
  values(v_evento.venda_id,'reembolso_concluido','concluido','Reembolso confirmado',nullif(trim(coalesce(p_observacoes,'')),''),v_evento.valor,p_usuario_id,p_usuario_nome,jsonb_build_object('evento_pendente_id',p_evento_id,'movimentou_caixa',p_movimentar_caixa),now(),v_empresa)
  returning id into v_novo_id;

  return jsonb_build_object('ok',true,'eventoId',v_novo_id,'valor',v_evento.valor);
end;
$$;

create or replace function public.processar_cancelamento_devolucao_balcao(
  p_venda_id uuid,
  p_tipo text,
  p_itens jsonb,
  p_motivo text,
  p_observacoes text,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_reembolsar_caixa boolean default false,
  p_caixa_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_empresa uuid;
  v_venda public.balcao_vendas%rowtype;
  v_item public.balcao_venda_itens%rowtype;
  v_req jsonb; v_evento_id uuid; v_pendente_id uuid; v_qtd numeric; v_qtd_anterior numeric; v_qtd_disponivel numeric;
  v_local_retorno uuid; v_acao text; v_valor_item numeric; v_valor_evento numeric := 0; v_fator_liquido numeric := 1;
  v_reserva public.estoque_reservas%rowtype; v_saldo public.estoque_saldos%rowtype;
  v_liberar numeric; v_restante numeric; v_conta public.financeiro_contas_receber%rowtype; v_saldo_conta numeric;
  v_reembolso numeric := 0; v_reembolso_caixa numeric := 0; v_reembolso_pendente numeric := 0; v_caixa_disponivel numeric := 0;
  v_caixa public.balcao_caixas%rowtype; v_restam_itens integer := 0;
begin
  select empresa_id into v_empresa from public.usuarios where id=p_usuario_id;
  if v_empresa is null then raise exception 'Usuário sem empresa válida'; end if;
  if p_tipo not in ('cancelamento_total','devolucao_parcial') then raise exception 'Tipo de operação inválido.'; end if;
  if nullif(trim(coalesce(p_motivo,'')),'') is null then raise exception 'Informe o motivo.'; end if;

  select * into v_venda from public.balcao_vendas where id=p_venda_id and empresa_id=v_empresa for update;
  if v_venda.id is null then raise exception 'Venda não encontrada para esta empresa.'; end if;
  if v_venda.status='cancelada' then raise exception 'Venda já cancelada.'; end if;
  if v_venda.subtotal>0 then v_fator_liquido:=greatest(0,(v_venda.total/v_venda.subtotal)); end if;

  insert into public.balcao_venda_eventos(venda_id,tipo,status,motivo,observacoes,usuario_id,usuario_nome,empresa_id)
  values(p_venda_id,p_tipo,'concluido',trim(p_motivo),nullif(trim(coalesce(p_observacoes,'')),''),p_usuario_id,p_usuario_nome,v_empresa)
  returning id into v_evento_id;

  for v_item in select * from public.balcao_venda_itens where venda_id=p_venda_id and empresa_id=v_empresa order by created_at,id for update loop
    select coalesce(sum(ei.quantidade),0) into v_qtd_anterior
      from public.balcao_venda_evento_itens ei
      join public.balcao_venda_eventos e on e.id=ei.evento_id and e.empresa_id=v_empresa
      where ei.empresa_id=v_empresa and ei.venda_item_id=v_item.id and e.status='concluido' and e.tipo in ('cancelamento_total','devolucao_parcial');
    v_qtd_disponivel:=greatest(0,v_item.quantidade-v_qtd_anterior);
    if v_qtd_disponivel<=0 then continue; end if;

    if p_tipo='cancelamento_total' then
      v_qtd:=v_qtd_disponivel;
      v_local_retorno:=coalesce(v_item.local_origem_id,v_venda.local_estoque_id);
    else
      v_req:=null;
      select x into v_req from jsonb_array_elements(coalesce(p_itens,'[]'::jsonb)) x where x->>'itemId'=v_item.id::text limit 1;
      if v_req is null then continue; end if;
      v_qtd:=coalesce(nullif(v_req->>'quantidade','')::numeric,0);
      v_local_retorno:=coalesce(nullif(v_req->>'localRetornoId','')::uuid,v_item.local_origem_id,v_venda.local_estoque_id);
      if v_qtd<=0 then continue; end if;
      if v_qtd>v_qtd_disponivel then raise exception 'Quantidade devolvida excede o saldo do item %.',v_item.produto_nome; end if;
      if v_item.atendimento_status in ('reservado_outra_unidade','separando') then raise exception 'Devolução parcial não é permitida enquanto % está reservado/separando. Use cancelamento total ou conclua o atendimento.',v_item.produto_nome; end if;
    end if;

    if v_local_retorno is not null and not exists(select 1 from public.estoque_locais where id=v_local_retorno and empresa_id=v_empresa) then
      raise exception 'Local de retorno não pertence à empresa.';
    end if;

    if v_item.atendimento_status='aguardando_estoque' then
      v_acao:='nenhuma'; v_local_retorno:=null;
    elsif v_item.atendimento_status in ('reservado_outra_unidade','separando') then
      v_acao:='liberar_reserva'; v_restante:=v_qtd;
      for v_reserva in
        select * from public.estoque_reservas
        where empresa_id=v_empresa and origem_tipo='venda_balcao' and origem_id=p_venda_id and produto_id=v_item.produto_id
          and local_id=v_item.local_origem_id and status='ativa'
        order by created_at,id for update
      loop
        exit when v_restante<=0;
        v_liberar:=least(v_restante,v_reserva.quantidade);
        select * into v_saldo from public.estoque_saldos
          where empresa_id=v_empresa and produto_id=v_item.produto_id and local_id=v_reserva.local_id and (endereco_id is not distinct from v_reserva.endereco_id) for update;
        if v_saldo.id is null or v_saldo.quantidade_reservada<v_liberar then raise exception 'Reserva inconsistente para %.',v_item.produto_nome; end if;
        update public.estoque_saldos set quantidade_reservada=quantidade_reservada-v_liberar,updated_at=now() where id=v_saldo.id and empresa_id=v_empresa;
        if v_liberar>=v_reserva.quantidade then
          update public.estoque_reservas set status='cancelada',updated_at=now(),observacoes=concat_ws(E'\n',observacoes,'Liberada por cancelamento/devolução da venda balcão.') where id=v_reserva.id and empresa_id=v_empresa;
        else
          update public.estoque_reservas set quantidade=quantidade-v_liberar,updated_at=now(),observacoes=concat_ws(E'\n',observacoes,'Reserva reduzida por cancelamento/devolução da venda balcão.') where id=v_reserva.id and empresa_id=v_empresa;
        end if;
        v_restante:=v_restante-v_liberar;
      end loop;
      if v_restante>0 then raise exception 'Não foi possível liberar toda a reserva de %.',v_item.produto_nome; end if;
    else
      v_acao:='entrada';
      if v_local_retorno is null then raise exception 'Informe o local de retorno para %.',v_item.produto_nome; end if;
      select * into v_saldo from public.estoque_saldos where empresa_id=v_empresa and produto_id=v_item.produto_id and local_id=v_local_retorno and endereco_id is null for update;
      if v_saldo.id is null then
        insert into public.estoque_saldos(produto_id,local_id,endereco_id,unidade,quantidade,quantidade_reservada,custo_medio,valor_estoque,empresa_id)
        values(v_item.produto_id,v_local_retorno,null,v_item.unidade,v_qtd,0,coalesce(v_item.custo_unitario_snapshot,0),v_qtd*coalesce(v_item.custo_unitario_snapshot,0),v_empresa)
        returning * into v_saldo;
      else
        update public.estoque_saldos set quantidade=quantidade+v_qtd,valor_estoque=valor_estoque+(v_qtd*coalesce(v_item.custo_unitario_snapshot,custo_medio,0)),updated_at=now() where id=v_saldo.id and empresa_id=v_empresa;
      end if;
      insert into public.estoque_movimentos(produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,origem_tipo,origem_id,observacoes,criado_por_id,criado_por_nome,local_destino_id,empresa_id)
      values(v_item.produto_id,'entrada',v_qtd,v_item.unidade,coalesce(v_item.custo_unitario_snapshot,0),v_qtd*coalesce(v_item.custo_unitario_snapshot,0),'devolucao_venda_balcao',v_evento_id,'Retorno da venda balcão #'||v_venda.numero,p_usuario_id,p_usuario_nome,v_local_retorno,v_empresa);
    end if;

    v_valor_item:=round(v_qtd*v_item.preco_unitario*v_fator_liquido,2); v_valor_evento:=v_valor_evento+v_valor_item;
    insert into public.balcao_venda_evento_itens(evento_id,venda_item_id,produto_id,quantidade,valor_liquido,local_retorno_id,acao_estoque,empresa_id)
    values(v_evento_id,v_item.id,v_item.produto_id,v_qtd,v_valor_item,v_local_retorno,v_acao,v_empresa);
  end loop;

  if v_valor_evento<=0 then raise exception 'Nenhum item disponível para cancelar/devolver.'; end if;

  v_reembolso:=v_valor_evento;
  for v_conta in select * from public.financeiro_contas_receber where empresa_id=v_empresa and venda_balcao_id=p_venda_id and status in ('aberto','vencido') order by vencimento desc,id for update loop
    exit when v_reembolso<=0;
    v_saldo_conta:=greatest(0,v_conta.valor-coalesce(v_conta.valor_pago,0));
    if v_saldo_conta<=0 then continue; end if;
    if v_reembolso+0.001>=v_saldo_conta then
      update public.financeiro_contas_receber set status='cancelado',updated_at=now(),observacoes=concat_ws(E'\n',observacoes,'Cancelado/reduzido pela devolução da venda balcão #'||v_venda.numero) where id=v_conta.id and empresa_id=v_empresa;
      v_reembolso:=v_reembolso-v_saldo_conta;
    else
      update public.financeiro_contas_receber set valor=greatest(coalesce(valor_pago,0),valor-v_reembolso),updated_at=now(),observacoes=concat_ws(E'\n',observacoes,'Valor reduzido pela devolução da venda balcão #'||v_venda.numero) where id=v_conta.id and empresa_id=v_empresa;
      v_reembolso:=0;
    end if;
  end loop;

  if v_reembolso>0 and p_reembolsar_caixa then
    select coalesce(sum(entrada),0)-coalesce(sum(saida) filter (where tipo='estorno'),0) into v_caixa_disponivel
      from public.balcao_caixa_movimentos
      where empresa_id=v_empresa and venda_id=p_venda_id and (tipo='estorno' or (tipo='recebimento' and coalesce(forma_pagamento,'') not in ('cartao_debito','cartao_credito')));
    v_reembolso_caixa:=least(v_reembolso,greatest(0,v_caixa_disponivel));
    if v_reembolso_caixa>0 then
      if p_caixa_id is null then raise exception 'Informe um caixa aberto para efetuar o reembolso.'; end if;
      select * into v_caixa from public.balcao_caixas where id=p_caixa_id and empresa_id=v_empresa for update;
      if v_caixa.id is null or v_caixa.status<>'aberto' then raise exception 'Caixa informado não está aberto para esta empresa.'; end if;
      insert into public.balcao_caixa_movimentos(caixa_id,venda_id,tipo,forma_pagamento,saida,descricao,criado_por_id,criado_por_nome,empresa_id)
      values(p_caixa_id,p_venda_id,'estorno','reembolso',v_reembolso_caixa,'Reembolso da venda balcão #'||v_venda.numero,p_usuario_id,p_usuario_nome,v_empresa);
    end if;
  end if;
  v_reembolso_pendente:=greatest(0,v_reembolso-v_reembolso_caixa);

  update public.balcao_venda_eventos set valor=round(v_valor_evento,2),concluido_em=now(),dados=jsonb_build_object('reembolso_caixa',round(v_reembolso_caixa,2),'reembolso_pendente',round(v_reembolso_pendente,2)) where id=v_evento_id and empresa_id=v_empresa;

  if v_reembolso_pendente>0 then
    insert into public.balcao_venda_eventos(venda_id,tipo,status,motivo,observacoes,valor,usuario_id,usuario_nome,dados,empresa_id)
    values(p_venda_id,'reembolso_pendente','pendente','Reembolso pendente após '||case when p_tipo='cancelamento_total' then 'cancelamento' else 'devolução' end,'Confirmar posteriormente quando o valor for devolvido ao cliente.',round(v_reembolso_pendente,2),p_usuario_id,p_usuario_nome,jsonb_build_object('evento_origem_id',v_evento_id),v_empresa)
    returning id into v_pendente_id;
  end if;

  select count(*) into v_restam_itens
    from public.balcao_venda_itens vi
    where vi.empresa_id=v_empresa and vi.venda_id=p_venda_id and vi.quantidade > coalesce((
      select sum(ei.quantidade) from public.balcao_venda_evento_itens ei join public.balcao_venda_eventos e on e.id=ei.evento_id and e.empresa_id=v_empresa
      where ei.empresa_id=v_empresa and ei.venda_item_id=vi.id and e.status='concluido' and e.tipo in ('cancelamento_total','devolucao_parcial')
    ),0);

  if v_restam_itens=0 then
    update public.balcao_vendas set status='cancelada',atendimento_status='cancelado',cancelada_em=now(),cancelada_por_id=p_usuario_id,cancelada_por_nome=p_usuario_nome,motivo_cancelamento=p_motivo where id=p_venda_id and empresa_id=v_empresa;
    update public.balcao_venda_itens set atendimento_status='cancelado' where venda_id=p_venda_id and empresa_id=v_empresa;
  else
    update public.balcao_vendas set status='devolvida_parcial',atendimento_status=case when atendimento_status='cancelado' then 'parcial' else atendimento_status end where id=p_venda_id and empresa_id=v_empresa;
  end if;

  return jsonb_build_object('ok',true,'eventoId',v_evento_id,'valor',round(v_valor_evento,2),'reembolsoCaixa',round(v_reembolso_caixa,2),'reembolsoPendente',round(v_reembolso_pendente,2),'reembolsoPendenteId',v_pendente_id,'statusVenda',case when v_restam_itens=0 then 'cancelada' else 'devolvida_parcial' end);
end;
$$;

create or replace function public.processar_cancelamento_devolucao_balcao(
  p_venda_id uuid,
  p_tipo text,
  p_itens jsonb,
  p_motivo text,
  p_observacoes text,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_reembolsar_caixa boolean,
  p_caixa_id uuid,
  p_chave_idempotencia uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_empresa uuid;
  v_existente record;
  v_resultado jsonb;
  v_evento_id uuid;
begin
  select empresa_id into v_empresa from public.usuarios where id=p_usuario_id;
  if v_empresa is null then raise exception 'Usuário sem empresa válida'; end if;
  if p_chave_idempotencia is null then raise exception 'Chave de idempotência obrigatória.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_chave_idempotencia::text,0));
  select e.*,v.status as venda_status into v_existente
    from public.balcao_venda_eventos e
    join public.balcao_vendas v on v.id=e.venda_id and v.empresa_id=v_empresa
   where e.empresa_id=v_empresa and e.chave_idempotencia=p_chave_idempotencia limit 1;
  if v_existente.id is not null then
    return jsonb_build_object('ok',true,'idempotente',true,'eventoId',v_existente.id,'valor',v_existente.valor,'reembolsoCaixa',coalesce((v_existente.dados->>'reembolso_caixa')::numeric,0),'reembolsoPendente',coalesce((v_existente.dados->>'reembolso_pendente')::numeric,0),'statusVenda',v_existente.venda_status);
  end if;
  v_resultado:=public.processar_cancelamento_devolucao_balcao(p_venda_id,p_tipo,p_itens,p_motivo,p_observacoes,p_usuario_id,p_usuario_nome,p_reembolsar_caixa,p_caixa_id);
  v_evento_id:=nullif(v_resultado->>'eventoId','')::uuid;
  if v_evento_id is null then raise exception 'Operação concluída sem evento de auditoria.'; end if;
  update public.balcao_venda_eventos set chave_idempotencia=p_chave_idempotencia where id=v_evento_id and empresa_id=v_empresa;
  return v_resultado || jsonb_build_object('chaveIdempotencia',p_chave_idempotencia);
end;
$$;

revoke all on function public.concluir_reembolso_balcao(uuid,uuid,text,boolean,uuid,text) from public,anon,authenticated;
revoke all on function public.processar_cancelamento_devolucao_balcao(uuid,text,jsonb,text,text,uuid,text,boolean,uuid) from public,anon,authenticated;
revoke all on function public.processar_cancelamento_devolucao_balcao(uuid,text,jsonb,text,text,uuid,text,boolean,uuid,uuid) from public,anon,authenticated;
grant execute on function public.concluir_reembolso_balcao(uuid,uuid,text,boolean,uuid,text) to service_role;
grant execute on function public.processar_cancelamento_devolucao_balcao(uuid,text,jsonb,text,text,uuid,text,boolean,uuid) to service_role;
grant execute on function public.processar_cancelamento_devolucao_balcao(uuid,text,jsonb,text,text,uuid,text,boolean,uuid,uuid) to service_role;
