alter table public.estoque_transferencias alter column empresa_id set not null;
alter table public.estoque_transferencia_itens alter column empresa_id set not null;

create or replace function public.criar_transferencia_estoque(
  p_local_origem_id uuid,
  p_local_destino_id uuid,
  p_itens jsonb,
  p_motivo text,
  p_previsao date,
  p_usuario_id uuid,
  p_usuario_nome text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_empresa uuid;
  v_transferencia_id uuid;
  v_numero bigint;
  i jsonb;
  v_produto_id uuid;
  v_qtd numeric;
  v_reserva jsonb;
begin
  select empresa_id into v_empresa from public.usuarios where id=p_usuario_id;
  if v_empresa is null then raise exception 'Usuário sem empresa válida'; end if;
  if p_local_origem_id=p_local_destino_id then raise exception 'Origem e destino devem ser diferentes'; end if;
  if p_itens is null or jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then raise exception 'Informe ao menos um item'; end if;
  if not exists(select 1 from public.estoque_locais where id=p_local_origem_id and empresa_id=v_empresa) then raise exception 'Local de origem não pertence à empresa'; end if;
  if not exists(select 1 from public.estoque_locais where id=p_local_destino_id and empresa_id=v_empresa) then raise exception 'Local de destino não pertence à empresa'; end if;

  insert into public.estoque_transferencias(local_origem_id,local_destino_id,motivo,previsao,solicitado_por_id,solicitado_por_nome,empresa_id)
  values(p_local_origem_id,p_local_destino_id,nullif(trim(p_motivo),''),p_previsao,p_usuario_id,p_usuario_nome,v_empresa)
  returning id,numero into v_transferencia_id,v_numero;

  for i in select * from jsonb_array_elements(p_itens)
  loop
    v_produto_id:=(i->>'produtoId')::uuid;
    v_qtd:=(i->>'quantidade')::numeric;
    if v_produto_id is null or v_qtd is null or v_qtd<=0 then raise exception 'Item de transferência inválido'; end if;
    if not exists(select 1 from public.produtos where id=v_produto_id and empresa_id=v_empresa) then raise exception 'Produto não pertence à empresa'; end if;

    insert into public.estoque_transferencia_itens(transferencia_id,produto_id,quantidade_solicitada,empresa_id)
    values(v_transferencia_id,v_produto_id,v_qtd,v_empresa);

    v_reserva:=public.reservar_estoque_local(v_produto_id,p_local_origem_id,v_qtd,'transferencia',v_transferencia_id,null,'Reserva para transferência '||v_numero,null,p_usuario_id,p_usuario_nome);
    if coalesce((v_reserva->>'ok')::boolean,false)=false then
      raise exception 'Saldo insuficiente para produto %. Disponível: %',v_produto_id,coalesce(v_reserva->>'disponivel','0');
    end if;
  end loop;

  return jsonb_build_object('ok',true,'transferencia_id',v_transferencia_id,'numero',v_numero);
end;
$$;

create or replace function public.avancar_transferencia_estoque(p_transferencia_id uuid, p_acao text, p_usuario_id uuid, p_usuario_nome text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_empresa uuid;
  t public.estoque_transferencias%rowtype;
  i public.estoque_transferencia_itens%rowtype;
  r public.estoque_reservas%rowtype;
  s public.estoque_saldos%rowtype;
  d public.estoque_saldos%rowtype;
  v_valor numeric;
  v_custo_ponderado numeric;
  v_qtd_total numeric;
  v_nova_qtd numeric;
  v_novo_valor numeric;
  v_novo_custo numeric;
begin
  select empresa_id into v_empresa from public.usuarios where id=p_usuario_id;
  if v_empresa is null then raise exception 'Usuário sem empresa válida'; end if;

  select * into t from public.estoque_transferencias where id=p_transferencia_id and empresa_id=v_empresa for update;
  if t.id is null then raise exception 'Transferência não encontrada para esta empresa'; end if;

  if p_acao='separar' then
    if t.status not in ('solicitada','separacao') then raise exception 'Transferência não pode ir para separação'; end if;
    update public.estoque_transferencias set status='separacao',updated_at=now() where id=t.id and empresa_id=v_empresa;
    return jsonb_build_object('ok',true,'status','separacao');
  end if;

  if p_acao='cancelar' then
    if t.status not in ('solicitada','separacao') then raise exception 'Só é possível cancelar antes do envio'; end if;
    for r in select * from public.estoque_reservas where empresa_id=v_empresa and origem_tipo='transferencia' and origem_id=t.id and status='ativa' for update
    loop
      update public.estoque_saldos set quantidade_reservada=greatest(0,quantidade_reservada-r.quantidade),updated_at=now()
       where empresa_id=v_empresa and produto_id=r.produto_id and local_id=r.local_id and (endereco_id is not distinct from r.endereco_id);
      update public.estoque_reservas set status='cancelada',updated_at=now() where id=r.id and empresa_id=v_empresa;
    end loop;
    update public.estoque_transferencias set status='cancelada',updated_at=now() where id=t.id and empresa_id=v_empresa;
    return jsonb_build_object('ok',true,'status','cancelada');
  end if;

  if p_acao='enviar' then
    if t.status not in ('solicitada','separacao') then raise exception 'Transferência não pode ser enviada neste status'; end if;
    for i in select * from public.estoque_transferencia_itens where transferencia_id=t.id and empresa_id=v_empresa for update
    loop
      v_qtd_total:=0;v_valor:=0;
      for r in select * from public.estoque_reservas where empresa_id=v_empresa and origem_tipo='transferencia' and origem_id=t.id and produto_id=i.produto_id and status='ativa' for update
      loop
        select * into s from public.estoque_saldos where empresa_id=v_empresa and produto_id=r.produto_id and local_id=r.local_id and (endereco_id is not distinct from r.endereco_id) for update;
        if s.id is null or s.quantidade<r.quantidade or s.quantidade_reservada<r.quantidade then raise exception 'Saldo reservado inconsistente'; end if;
        v_qtd_total:=v_qtd_total+r.quantidade;v_valor:=v_valor+r.quantidade*coalesce(s.custo_medio,0);
        update public.estoque_saldos set quantidade=quantidade-r.quantidade,quantidade_reservada=quantidade_reservada-r.quantidade,valor_estoque=greatest(0,valor_estoque-r.quantidade*coalesce(custo_medio,0)),updated_at=now() where id=s.id and empresa_id=v_empresa;
        insert into public.estoque_movimentos(produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,origem_tipo,origem_id,local_origem_id,endereco_origem_id,criado_por_id,criado_por_nome,empresa_id)
        values(i.produto_id,'saida',r.quantidade,s.unidade,s.custo_medio,r.quantidade*coalesce(s.custo_medio,0),'transferencia_envio',t.id,t.local_origem_id,r.endereco_id,p_usuario_id,p_usuario_nome,v_empresa);
        update public.estoque_reservas set status='atendida',updated_at=now() where id=r.id and empresa_id=v_empresa;
      end loop;
      if v_qtd_total<>i.quantidade_solicitada then raise exception 'Quantidade reservada diferente da solicitada'; end if;
      v_custo_ponderado:=case when v_qtd_total>0 then v_valor/v_qtd_total else null end;
      update public.estoque_transferencia_itens set quantidade_separada=v_qtd_total,custo_unitario=v_custo_ponderado,unidade=(select unidade from public.produtos where id=i.produto_id and empresa_id=v_empresa) where id=i.id and empresa_id=v_empresa;
    end loop;
    update public.estoque_transferencias set status='em_transito',enviado_em=now(),updated_at=now() where id=t.id and empresa_id=v_empresa;
    return jsonb_build_object('ok',true,'status','em_transito');
  end if;

  if p_acao='receber' then
    if t.status<>'em_transito' then raise exception 'Transferência não está em trânsito'; end if;
    for i in select * from public.estoque_transferencia_itens where transferencia_id=t.id and empresa_id=v_empresa for update
    loop
      if i.quantidade_separada<=0 then raise exception 'Item sem quantidade enviada'; end if;
      select * into d from public.estoque_saldos where empresa_id=v_empresa and produto_id=i.produto_id and local_id=t.local_destino_id and endereco_id is null for update;
      if d.id is null then
        insert into public.estoque_saldos(produto_id,local_id,unidade,quantidade,quantidade_reservada,custo_medio,valor_estoque,empresa_id)
        values(i.produto_id,t.local_destino_id,coalesce(i.unidade,(select unidade from public.produtos where id=i.produto_id and empresa_id=v_empresa)),i.quantidade_separada,0,i.custo_unitario,i.quantidade_separada*coalesce(i.custo_unitario,0),v_empresa);
      else
        v_nova_qtd:=d.quantidade+i.quantidade_separada;v_novo_valor:=d.valor_estoque+i.quantidade_separada*coalesce(i.custo_unitario,0);v_novo_custo:=case when v_nova_qtd>0 then v_novo_valor/v_nova_qtd else d.custo_medio end;
        update public.estoque_saldos set quantidade=v_nova_qtd,valor_estoque=v_novo_valor,custo_medio=v_novo_custo,updated_at=now() where id=d.id and empresa_id=v_empresa;
      end if;
      insert into public.estoque_movimentos(produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,origem_tipo,origem_id,local_destino_id,criado_por_id,criado_por_nome,empresa_id)
      values(i.produto_id,'entrada',i.quantidade_separada,coalesce(i.unidade,(select unidade from public.produtos where id=i.produto_id and empresa_id=v_empresa)),i.custo_unitario,i.quantidade_separada*coalesce(i.custo_unitario,0),'transferencia_recebimento',t.id,t.local_destino_id,p_usuario_id,p_usuario_nome,v_empresa);
      update public.estoque_transferencia_itens set quantidade_recebida=quantidade_separada where id=i.id and empresa_id=v_empresa;
    end loop;
    update public.estoque_transferencias set status='recebida',recebido_por_id=p_usuario_id,recebido_por_nome=p_usuario_nome,recebido_em=now(),updated_at=now() where id=t.id and empresa_id=v_empresa;
    return jsonb_build_object('ok',true,'status','recebida');
  end if;

  raise exception 'Ação inválida';
end;
$$;

revoke all on function public.criar_transferencia_estoque(uuid,uuid,jsonb,text,date,uuid,text) from public,anon,authenticated;
revoke all on function public.avancar_transferencia_estoque(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.criar_transferencia_estoque(uuid,uuid,jsonb,text,date,uuid,text) to service_role;
grant execute on function public.avancar_transferencia_estoque(uuid,text,uuid,text) to service_role;
