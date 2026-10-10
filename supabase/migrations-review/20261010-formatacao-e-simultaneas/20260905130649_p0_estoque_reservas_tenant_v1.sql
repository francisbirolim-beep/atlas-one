create or replace function public.cancelar_reserva_estoque(p_reserva_id uuid, p_usuario_id uuid, p_usuario_nome text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r public.estoque_reservas%rowtype;
  v_empresa uuid;
begin
  select empresa_id into v_empresa from public.usuarios where id=p_usuario_id;
  if v_empresa is null then raise exception 'Usuário sem empresa válida'; end if;

  select * into r from public.estoque_reservas
   where id=p_reserva_id and empresa_id=v_empresa
   for update;
  if r.id is null then raise exception 'Reserva não encontrada para esta empresa'; end if;
  if r.status <> 'ativa' then return jsonb_build_object('ok',true,'ja_finalizada',true); end if;

  update public.estoque_reservas
     set status='cancelada',updated_at=now(),observacoes=concat_ws(E'\n',observacoes,'Cancelada por '||coalesce(p_usuario_nome,'usuário'))
   where id=p_reserva_id and empresa_id=v_empresa;

  update public.estoque_saldos
     set quantidade_reservada=greatest(0,quantidade_reservada-r.quantidade),updated_at=now()
   where empresa_id=v_empresa
     and produto_id=r.produto_id
     and local_id=r.local_id
     and (endereco_id is not distinct from r.endereco_id);

  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.reservar_estoque_local(
  p_produto_id uuid,
  p_local_id uuid,
  p_quantidade numeric,
  p_origem_tipo text,
  p_origem_id uuid,
  p_cliente_id uuid,
  p_observacoes text,
  p_reservado_ate timestamptz,
  p_usuario_id uuid,
  p_usuario_nome text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.estoque_saldos%rowtype;
  v_empresa uuid;
  v_disponivel_total numeric;
  v_restante numeric;
  v_alocar numeric;
  v_reserva_id uuid;
  v_ids jsonb := '[]'::jsonb;
begin
  select empresa_id into v_empresa from public.usuarios where id=p_usuario_id;
  if v_empresa is null then raise exception 'Usuário sem empresa válida'; end if;
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'Quantidade inválida'; end if;

  if not exists(select 1 from public.produtos where id=p_produto_id and empresa_id=v_empresa) then
    raise exception 'Produto não pertence à empresa';
  end if;
  if not exists(select 1 from public.estoque_locais where id=p_local_id and empresa_id=v_empresa) then
    raise exception 'Local não pertence à empresa';
  end if;
  if p_cliente_id is not null and not exists(select 1 from public.clientes where id=p_cliente_id and empresa_id=v_empresa) then
    raise exception 'Cliente não pertence à empresa';
  end if;

  select coalesce(sum(greatest(0,quantidade-quantidade_reservada)),0)
    into v_disponivel_total
    from public.estoque_saldos
   where empresa_id=v_empresa and produto_id=p_produto_id and local_id=p_local_id;

  if v_disponivel_total < p_quantidade then
    return jsonb_build_object('ok',false,'motivo','saldo_insuficiente','disponivel',v_disponivel_total);
  end if;

  v_restante:=p_quantidade;
  for s in
    select * from public.estoque_saldos
     where empresa_id=v_empresa
       and produto_id=p_produto_id
       and local_id=p_local_id
       and quantidade>quantidade_reservada
     order by (quantidade-quantidade_reservada) desc,id
     for update
  loop
    exit when v_restante<=0;
    v_alocar:=least(v_restante,greatest(0,s.quantidade-s.quantidade_reservada));
    if v_alocar>0 then
      insert into public.estoque_reservas(
        produto_id,local_id,endereco_id,quantidade,origem_tipo,origem_id,cliente_id,observacoes,reservado_ate,criado_por_id,criado_por_nome,empresa_id
      ) values(
        p_produto_id,p_local_id,s.endereco_id,v_alocar,p_origem_tipo,p_origem_id,p_cliente_id,p_observacoes,p_reservado_ate,p_usuario_id,p_usuario_nome,v_empresa
      ) returning id into v_reserva_id;
      v_ids:=v_ids||jsonb_build_array(v_reserva_id);
      update public.estoque_saldos
         set quantidade_reservada=quantidade_reservada+v_alocar,updated_at=now()
       where id=s.id and empresa_id=v_empresa;
      v_restante:=v_restante-v_alocar;
    end if;
  end loop;

  if v_restante>0 then raise exception 'Falha concorrente ao reservar estoque'; end if;
  return jsonb_build_object('ok',true,'reserva_ids',v_ids,'quantidade',p_quantidade,'disponivel_apos',v_disponivel_total-p_quantidade);
end;
$$;

revoke all on function public.reservar_estoque_local(uuid,uuid,numeric,text,uuid,uuid,text,timestamptz,uuid,text) from public,anon,authenticated;
revoke all on function public.cancelar_reserva_estoque(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reservar_estoque_local(uuid,uuid,numeric,text,uuid,uuid,text,timestamptz,uuid,text) to service_role;
grant execute on function public.cancelar_reserva_estoque(uuid,uuid,text) to service_role;
