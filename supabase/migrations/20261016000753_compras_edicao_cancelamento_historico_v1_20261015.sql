-- Cancelamento logico rastreavel: nao desfaz ordens ja enviadas nem estoque.
begin;
alter table public.compras_solicitacao_itens
  add column if not exists motivo_cancelamento text,
  add column if not exists cancelamento_solicitado_em timestamptz;
alter table public.compras_solicitacao_itens drop constraint if exists compras_solicitacao_itens_status_check;
alter table public.compras_solicitacao_itens add constraint compras_solicitacao_itens_status_check
  check(status in ('ativo','cancelado','cancelamento_solicitado'));

-- Carrinho antigo e novo nao podem ganhar quantidade de itens com exclusao solicitada.
create or replace function private.compras_carrinho_item_validar()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_item record;v_status text;v_uso numeric;
begin
 select i.solicitacao_id,i.quantidade_necessaria,i.status,i.destino into v_item
 from public.compras_solicitacao_itens i
 where i.id=new.item_id and i.empresa_id=new.empresa_id for update of i;
 if not found or v_item.status in ('cancelado','cancelamento_solicitado') then
  raise exception 'Item cancelado ou com cancelamento pendente';end if;
 select status into v_status from public.compras_carrinhos
 where id=new.carrinho_id and empresa_id=new.empresa_id;
 if v_status is null or v_status<>'rascunho' then
  raise exception 'Carrinho nao esta em rascunho';end if;
 if v_item.destino='estoque' and new.quantidade_obra<>0 then
  raise exception 'Quantidade obra proibida para estoque';end if;
 select coalesce(sum(ci.quantidade_obra),0) into v_uso
 from public.compras_carrinho_itens ci
 join public.compras_carrinhos ca on ca.id=ci.carrinho_id
 where ci.item_id=new.item_id and ci.id<>new.id and ca.status<>'cancelado';
 if v_item.destino='obra' and v_uso+new.quantidade_obra>v_item.quantidade_necessaria then
  raise exception 'Quantidade obra maior que a necessidade';end if;
 if tg_op='UPDATE' and (new.empresa_id<>old.empresa_id or
  new.item_id<>old.item_id or new.carrinho_id<>old.carrinho_id) then
  raise exception 'Origem da compra imutavel';end if;
 return new;
end; $$;
commit;