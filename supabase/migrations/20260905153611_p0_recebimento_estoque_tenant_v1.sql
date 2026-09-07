begin;

alter table public.compras_recebimento_itens alter column empresa_id set not null;
alter table public.compras_recebimento_fotos alter column empresa_id set not null;

create or replace function private.guard_compras_recebimento_item_empresa()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_empresa_recebimento uuid;
  v_empresa_nf_item uuid;
  v_empresa_produto uuid;
begin
  select r.empresa_id into v_empresa_recebimento
  from public.compras_recebimentos r where r.id = new.recebimento_id;
  if v_empresa_recebimento is null or new.empresa_id is distinct from v_empresa_recebimento then
    raise exception 'Recebimento/item pertence a outra empresa';
  end if;

  select i.empresa_id into v_empresa_nf_item
  from public.compras_nf_itens i where i.id = new.nf_item_id;
  if v_empresa_nf_item is null or new.empresa_id is distinct from v_empresa_nf_item then
    raise exception 'Item da NF pertence a outra empresa';
  end if;

  if new.produto_id is not null then
    select p.empresa_id into v_empresa_produto from public.produtos p where p.id = new.produto_id;
    if v_empresa_produto is null or new.empresa_id is distinct from v_empresa_produto then
      raise exception 'Produto pertence a outra empresa';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_compras_recebimento_item_empresa() from public, anon, authenticated;
grant execute on function private.guard_compras_recebimento_item_empresa() to service_role;
drop trigger if exists trg_compras_recebimento_item_empresa_guard on public.compras_recebimento_itens;
create trigger trg_compras_recebimento_item_empresa_guard
before insert or update on public.compras_recebimento_itens
for each row execute function private.guard_compras_recebimento_item_empresa();

create or replace function private.guard_compras_recebimento_foto_empresa()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_empresa_recebimento uuid;
  v_empresa_nf_item uuid;
begin
  select r.empresa_id into v_empresa_recebimento
  from public.compras_recebimentos r where r.id = new.recebimento_id;
  if v_empresa_recebimento is null or new.empresa_id is distinct from v_empresa_recebimento then
    raise exception 'Foto/recebimento pertence a outra empresa';
  end if;
  if new.nf_item_id is not null then
    select i.empresa_id into v_empresa_nf_item from public.compras_nf_itens i where i.id = new.nf_item_id;
    if v_empresa_nf_item is null or new.empresa_id is distinct from v_empresa_nf_item then
      raise exception 'Foto/item da NF pertence a outra empresa';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_compras_recebimento_foto_empresa() from public, anon, authenticated;
grant execute on function private.guard_compras_recebimento_foto_empresa() to service_role;
drop trigger if exists trg_compras_recebimento_foto_empresa_guard on public.compras_recebimento_fotos;
create trigger trg_compras_recebimento_foto_empresa_guard
before insert or update on public.compras_recebimento_fotos
for each row execute function private.guard_compras_recebimento_foto_empresa();

create or replace function public.aplicar_estoque_recebimento(
  p_recebimento_item_id uuid,
  p_usuario_id uuid,
  p_usuario_nome text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  r record;
  v_empresa_id uuid;
  v_empresa_usuario uuid;
  v_fator numeric;
  v_qtd_util numeric;
  v_custo_compra numeric;
  v_custo_estoque numeric;
  v_local_id uuid;
  v_saldo record;
  v_nova_qtd numeric;
  v_novo_valor numeric;
  v_novo_custo numeric;
begin
  select u.empresa_id into v_empresa_usuario from public.usuarios u where u.id = p_usuario_id;
  if v_empresa_usuario is null then raise exception 'Usuário sem empresa válida'; end if;

  select ri.*,ci.nf_id,ci.custo_aquisicao_unitario,ci.unidade,ci.fator_conversao,ci.unidade_estoque,
         cr.id as recebimento_id,cn.fornecedor_id,cn.empresa_id as empresa_nf,
         ci.empresa_id as empresa_nf_item,cr.empresa_id as empresa_recebimento,p.empresa_id as empresa_produto
  into r
  from public.compras_recebimento_itens ri
  join public.compras_nf_itens ci on ci.id = ri.nf_item_id
  join public.compras_recebimentos cr on cr.id = ri.recebimento_id
  join public.compras_nfs cn on cn.id = ci.nf_id
  left join public.produtos p on p.id = ri.produto_id
  where ri.id = p_recebimento_item_id
    and ri.empresa_id = v_empresa_usuario
    and ci.empresa_id = v_empresa_usuario
    and cr.empresa_id = v_empresa_usuario
    and cn.empresa_id = v_empresa_usuario;

  if r.id is null then raise exception 'Item de recebimento não encontrado para a empresa atual'; end if;
  v_empresa_id := v_empresa_usuario;
  if r.produto_id is null then return jsonb_build_object('ok',false,'motivo','produto_pendente'); end if;
  if r.empresa_produto is distinct from v_empresa_id then raise exception 'Produto pertence a outra empresa'; end if;

  if exists(select 1 from public.estoque_movimentos m where m.recebimento_item_id=p_recebimento_item_id and m.origem_tipo='recebimento_nf' and m.empresa_id=v_empresa_id) then
    return jsonb_build_object('ok',true,'duplicado',true);
  end if;

  v_fator := coalesce(r.fator_conversao,(
    select pf.fator_conversao from public.produto_fornecedores pf
    where pf.produto_id=r.produto_id and pf.fornecedor_id=r.fornecedor_id and pf.empresa_id=v_empresa_id and pf.ativo=true
    order by pf.preferencial desc,pf.updated_at desc limit 1
  ));
  if v_fator is null or v_fator<=0 then return jsonb_build_object('ok',false,'motivo','conversao_pendente'); end if;

  v_qtd_util := greatest(0,coalesce(r.quantidade_recebida,0)-coalesce(r.quantidade_avariada,0))*v_fator;
  if v_qtd_util<=0 then return jsonb_build_object('ok',true,'quantidade',0); end if;

  v_custo_compra:=coalesce(r.custo_aquisicao_unitario,0);
  v_custo_estoque:=case when v_fator>0 then v_custo_compra/v_fator else null end;

  select l.id into v_local_id
  from public.estoque_locais l
  join public.unidades_operacionais u on u.id=l.unidade_id
  where l.empresa_id=v_empresa_id and u.empresa_id=v_empresa_id and u.codigo='MATRIZ' and l.codigo='GERAL'
  limit 1;
  if v_local_id is null then raise exception 'Local padrão de estoque não encontrado para a empresa atual'; end if;

  select * into v_saldo from public.estoque_saldos
  where empresa_id=v_empresa_id and produto_id=r.produto_id and local_id=v_local_id and endereco_id is null for update;

  if v_saldo.id is null then
    v_nova_qtd:=v_qtd_util;
    v_novo_valor:=v_qtd_util*coalesce(v_custo_estoque,0);
    v_novo_custo:=case when v_nova_qtd>0 then v_novo_valor/v_nova_qtd else null end;
    insert into public.estoque_saldos(empresa_id,produto_id,local_id,unidade,quantidade,quantidade_reservada,custo_medio,valor_estoque)
    values(v_empresa_id,r.produto_id,v_local_id,coalesce(r.unidade_estoque,(select unidade from public.produtos where id=r.produto_id and empresa_id=v_empresa_id)),v_nova_qtd,0,v_novo_custo,v_novo_valor);
  else
    v_nova_qtd:=v_saldo.quantidade+v_qtd_util;
    v_novo_valor:=v_saldo.valor_estoque+v_qtd_util*coalesce(v_custo_estoque,0);
    v_novo_custo:=case when v_nova_qtd>0 then v_novo_valor/v_nova_qtd else v_saldo.custo_medio end;
    update public.estoque_saldos set quantidade=v_nova_qtd,valor_estoque=v_novo_valor,custo_medio=v_novo_custo,
      unidade=coalesce(unidade,r.unidade_estoque),updated_at=now()
    where id=v_saldo.id and empresa_id=v_empresa_id;
  end if;

  insert into public.estoque_movimentos(empresa_id,produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,
    quantidade_avariada_origem,origem_tipo,origem_id,nf_id,nf_item_id,recebimento_id,recebimento_item_id,
    local_destino_id,criado_por_id,criado_por_nome)
  values(v_empresa_id,r.produto_id,'entrada',v_qtd_util,
    coalesce(r.unidade_estoque,(select unidade from public.produtos where id=r.produto_id and empresa_id=v_empresa_id)),
    v_custo_estoque,v_qtd_util*coalesce(v_custo_estoque,0),coalesce(r.quantidade_avariada,0),'recebimento_nf',
    r.recebimento_id,r.nf_id,r.nf_item_id,r.recebimento_id,p_recebimento_item_id,v_local_id,p_usuario_id,p_usuario_nome);

  update public.produtos set custo=v_novo_custo,updated_at=now()
  where id=r.produto_id and empresa_id=v_empresa_id and v_novo_custo is not null;

  return jsonb_build_object('ok',true,'quantidade',v_qtd_util,'custo_medio',v_novo_custo,'local_id',v_local_id);
end;
$$;
revoke all on function public.aplicar_estoque_recebimento(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.aplicar_estoque_recebimento(uuid,uuid,text) to service_role;

commit;