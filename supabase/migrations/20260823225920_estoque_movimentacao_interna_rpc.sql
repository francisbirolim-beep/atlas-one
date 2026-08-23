-- Atlas One — movimentação interna para endereçar produtos sem alterar estoque total.

create or replace function public.movimentar_estoque_interno(
  p_saldo_origem_id uuid,
  p_endereco_destino_id uuid,
  p_quantidade numeric,
  p_usuario_id uuid,
  p_usuario_nome text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  o record;
  e record;
  d record;
  v_disponivel numeric;
  v_valor numeric;
  v_nova_qtd numeric;
  v_novo_valor numeric;
  v_novo_custo numeric;
  v_mov_id uuid:=gen_random_uuid();
begin
  if p_quantidade is null or p_quantidade<=0 then raise exception 'Quantidade inválida'; end if;
  select * into o from public.estoque_saldos where id=p_saldo_origem_id for update;
  if o.id is null then raise exception 'Saldo de origem não encontrado'; end if;
  select * into e from public.estoque_enderecos where id=p_endereco_destino_id and ativo=true;
  if e.id is null then raise exception 'Endereço de destino não encontrado'; end if;
  if e.local_id<>o.local_id then raise exception 'O endereço deve pertencer ao mesmo local de estoque'; end if;
  if o.endereco_id is not distinct from e.id then return jsonb_build_object('ok',true,'sem_alteracao',true); end if;
  v_disponivel:=greatest(0,o.quantidade-o.quantidade_reservada);
  if v_disponivel<p_quantidade then return jsonb_build_object('ok',false,'motivo','saldo_disponivel_insuficiente','disponivel',v_disponivel); end if;
  v_valor:=p_quantidade*coalesce(o.custo_medio,0);
  update public.estoque_saldos set quantidade=quantidade-p_quantidade,valor_estoque=greatest(0,valor_estoque-v_valor),updated_at=now() where id=o.id;
  select * into d from public.estoque_saldos where produto_id=o.produto_id and local_id=o.local_id and endereco_id=e.id for update;
  if d.id is null then
    insert into public.estoque_saldos(produto_id,local_id,endereco_id,unidade,quantidade,quantidade_reservada,custo_medio,valor_estoque)
    values(o.produto_id,o.local_id,e.id,o.unidade,p_quantidade,0,o.custo_medio,v_valor);
  else
    v_nova_qtd:=d.quantidade+p_quantidade;v_novo_valor:=d.valor_estoque+v_valor;v_novo_custo:=case when v_nova_qtd>0 then v_novo_valor/v_nova_qtd else d.custo_medio end;
    update public.estoque_saldos set quantidade=v_nova_qtd,valor_estoque=v_novo_valor,custo_medio=v_novo_custo,updated_at=now() where id=d.id;
  end if;
  insert into public.estoque_movimentos(produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,origem_tipo,origem_id,local_origem_id,endereco_origem_id,local_destino_id,endereco_destino_id,observacoes,criado_por_id,criado_por_nome)
  values(o.produto_id,'saida',p_quantidade,o.unidade,o.custo_medio,v_valor,'movimentacao_interna',v_mov_id,o.local_id,o.endereco_id,o.local_id,e.id,'Endereçamento interno',p_usuario_id,p_usuario_nome);
  insert into public.estoque_movimentos(produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,origem_tipo,origem_id,local_origem_id,endereco_origem_id,local_destino_id,endereco_destino_id,observacoes,criado_por_id,criado_por_nome)
  values(o.produto_id,'entrada',p_quantidade,o.unidade,o.custo_medio,v_valor,'movimentacao_interna',v_mov_id,o.local_id,o.endereco_id,o.local_id,e.id,'Endereçamento interno',p_usuario_id,p_usuario_nome);
  return jsonb_build_object('ok',true,'quantidade',p_quantidade,'movimento_id',v_mov_id);
end;
$$;

revoke all on function public.movimentar_estoque_interno(uuid,uuid,numeric,uuid,text) from public,anon,authenticated;
grant execute on function public.movimentar_estoque_interno(uuid,uuid,numeric,uuid,text) to service_role;
