-- Destino por linha sem substituir o pedido agrupado nem seus registros anteriores.
-- O cabecalho permanece como o destino padrao do primeiro item, para compatibilidade.
begin;

alter table public.compras_solicitacao_itens
  add column if not exists destino text,
  add column if not exists cliente_id uuid references public.clientes(id),
  add column if not exists obra_id uuid references public.obras(id);

-- Mantem o destino de todos os pedidos antigos: retrocompatibilidade sem mudanca de origem.
update public.compras_solicitacao_itens i set
  destino = s.destino,
  cliente_id = s.cliente_id,
  obra_id = s.obra_id
from public.compras_solicitacoes s
where i.solicitacao_id=s.id and i.destino is null;

alter table public.compras_solicitacao_itens alter column destino set not null;
alter table public.compras_solicitacao_itens
  add constraint compras_solicitacao_itens_destino_valido_v1
  check ((destino='estoque' and cliente_id is null and obra_id is null) or
         (destino='obra' and cliente_id is not null and obra_id is not null));
create index if not exists compras_solicitacao_itens_obra_v1
  on public.compras_solicitacao_itens (empresa_id,obra_id) where destino='obra';

create or replace function private.compras_solicitacao_item_validar()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_empresa uuid;v_padrao record;
begin
 select empresa_id,destino,cliente_id,obra_id into v_padrao
 from public.compras_solicitacoes where id=new.solicitacao_id;
 v_empresa:=v_padrao.empresa_id;
 -- Chamadas antigas de Solicitar compra continuam válidas DURANTE o rollout.
 -- Quando a nova API informar destino individual, manter sempre o valor por linha.
 if new.destino is null then
  new.destino:=v_padrao.destino;
  new.cliente_id:=v_padrao.cliente_id;
  new.obra_id:=v_padrao.obra_id;
 end if;
 if v_empresa is null or v_empresa<>new.empresa_id then
  raise exception 'Solicitacao de outra empresa';
 end if;
 if new.destino not in ('obra','estoque') then raise exception 'Destino do item obrigatorio';end if;
 if new.destino='obra' then
  if new.quantidade_necessaria is null then raise exception 'Quantidade de obra obrigatoria';end if;
  if not exists (select 1 from public.obras o join public.clientes c on c.id=o.cliente_id
   where o.id=new.obra_id and c.id=new.cliente_id and o.empresa_id=new.empresa_id and c.empresa_id=new.empresa_id)
   then raise exception 'Cliente e obra do item nao correspondem';end if;
 elsif new.cliente_id is not null or new.obra_id is not null then
  raise exception 'Estoque nao pode indicar cliente ou obra';
 end if;
 if new.produto_id is not null and not exists
   (select 1 from public.produtos where id=new.produto_id and empresa_id=new.empresa_id)
   then raise exception 'Produto de outra empresa';end if;
 if tg_op='UPDATE' and (new.empresa_id<>old.empresa_id or new.solicitacao_id<>old.solicitacao_id)
   then raise exception 'Origem do item imutavel';end if;
 return new;
end; $$;

create or replace function private.compras_carrinho_item_validar()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_item record;v_status text;v_uso numeric;
begin
 select i.solicitacao_id,i.quantidade_necessaria,i.status,i.destino into v_item
 from public.compras_solicitacao_itens i
 where i.id=new.item_id and i.empresa_id=new.empresa_id for update of i;
 if not found or v_item.status='cancelado' then raise exception 'Item da solicitacao invalido';end if;
 select status into v_status from public.compras_carrinhos
  where id=new.carrinho_id and empresa_id=new.empresa_id;
 if v_status is null or v_status<>'rascunho' then
  raise exception 'Carrinho precisa estar em rascunho e na mesma empresa';end if;
 if v_item.destino='estoque' and new.quantidade_obra<>0 then
  raise exception 'Item de estoque nao pode atribuir quantidade a obra';end if;
 select coalesce(sum(ci.quantidade_obra),0) into v_uso
 from public.compras_carrinho_itens ci
 join public.compras_carrinhos ca on ca.id=ci.carrinho_id
 where ci.item_id=new.item_id and ci.id<>new.id and ca.status<>'cancelado';
 if v_item.destino='obra' and v_uso+new.quantidade_obra>v_item.quantidade_necessaria then
  raise exception 'Quantidade de obra excede solicitacao';end if;
 if tg_op='UPDATE' and (new.empresa_id<>old.empresa_id or
   new.item_id<>old.item_id or new.carrinho_id<>old.carrinho_id)
   then raise exception 'Origem de item do carrinho imutavel';end if;
 return new;
end; $$;

commit;
