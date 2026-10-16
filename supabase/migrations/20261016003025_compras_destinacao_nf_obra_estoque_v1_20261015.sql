-- Vínculo auditável: mercadoria JÁ recebida fisicamente pela rotina de NF.
-- Não cria novo movimento, reserva ou transferência de estoque.
begin;
create table if not exists public.compras_recebimento_destinos (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id),
 recebimento_item_id uuid not null references public.compras_recebimento_itens(id) on delete restrict,
 carrinho_item_id uuid not null references public.compras_carrinho_itens(id) on delete restrict,
 quantidade_obra numeric not null default 0 check(quantidade_obra>=0),
 quantidade_estoque numeric not null default 0 check(quantidade_estoque>=0),
 usuario_id uuid not null references auth.users(id) on delete restrict,
 criado_em timestamptz not null default now(),
 constraint compras_recebimento_destinos_qtd_check check(quantidade_obra+quantidade_estoque>0),
 constraint compras_recebimento_destinos_sem_duplicacao unique(recebimento_item_id,carrinho_item_id)
);
create index if not exists compras_recebimento_destinos_linha_idx on public.compras_recebimento_destinos(empresa_id,carrinho_item_id);
create index if not exists compras_recebimento_destinos_receb_idx on public.compras_recebimento_destinos(empresa_id,recebimento_item_id);
alter table public.compras_recebimento_destinos enable row level security;
revoke all on public.compras_recebimento_destinos from public,anon,authenticated;
grant select on public.compras_recebimento_destinos to service_role;

-- Mesma validação homologada de carrinhos, com uma exceção estrita:
-- após comprado, só os contadores de recebimento podem crescer.
-- A quantidade, o preço, o produto e o vínculo original permanecem imutáveis.
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
 if v_status is null then raise exception 'Carrinho não encontrado';end if;
 if tg_op='UPDATE' and (new.empresa_id<>old.empresa_id or
  new.item_id<>old.item_id or new.carrinho_id<>old.carrinho_id) then
  raise exception 'Origem da compra imutavel';end if;
 if v_status<>'rascunho' then
  if tg_op<>'UPDATE' then raise exception 'Carrinho comprado: novas linhas proibidas';end if;
  if new.quantidade_obra is distinct from old.quantidade_obra or
   new.quantidade_estoque is distinct from old.quantidade_estoque or
   new.preco_unitario is distinct from old.preco_unitario or
   new.created_at is distinct from old.created_at then
   raise exception 'Carrinho comprado: preço e quantidade são imutáveis';end if;
  if new.recebido_obra < old.recebido_obra or new.recebido_estoque < old.recebido_estoque then
   raise exception 'Recebimento não pode ser reduzido sem estorno auditado';end if;
  return new;
 end if;
 if v_item.destino='estoque' and new.quantidade_obra<>0 then
  raise exception 'Quantidade obra proibida para estoque';end if;
 select coalesce(sum(ci.quantidade_obra),0) into v_uso
 from public.compras_carrinho_itens ci
 join public.compras_carrinhos ca on ca.id=ci.carrinho_id
 where ci.item_id=new.item_id and ci.id<>new.id and ca.status<>'cancelado';
 if v_item.destino='obra' and v_uso+new.quantidade_obra>v_item.quantidade_necessaria then
  raise exception 'Quantidade obra maior que a necessidade';end if;
 return new;
end;$$;

create or replace function public.registrar_destino_recebimento_compras(
 p_empresa_id uuid,p_recebimento_item_id uuid,p_carrinho_item_id uuid,
 p_quantidade_obra numeric,p_quantidade_estoque numeric,p_usuario_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_nf record;v_linha record;v_solicitacao record;v_movimentado numeric;
 v_alocado numeric;v_restante_obra numeric;v_restante_estoque numeric;v_status text;
 v_solicitacao_status text;v_id uuid;v_pedido_completo boolean;
begin
 if not exists(select 1 from public.usuarios where id=p_usuario_id and empresa_id=p_empresa_id)
  then raise exception 'Usuário não pertence à empresa';end if;
 if coalesce(p_quantidade_obra,0)<0 or coalesce(p_quantidade_estoque,0)<0 or
    coalesce(p_quantidade_obra,0)+coalesce(p_quantidade_estoque,0)<=0
  then raise exception 'Quantidades destinadas devem ser positivas';end if;
 -- O lock da linha da conferência serializa concorrência e impede superar a NF física.
 select ri.id,ri.empresa_id,ri.nf_item_id,ri.recebimento_id,ri.produto_id,
  cr.status as status_recebimento,ci.nf_id,ci.produto_id as produto_nf,
  cn.fornecedor_id,cn.status as status_nf
 into v_nf
 from public.compras_recebimento_itens ri
 join public.compras_recebimentos cr on cr.id=ri.recebimento_id
 join public.compras_nf_itens ci on ci.id=ri.nf_item_id
 join public.compras_nfs cn on cn.id=ci.nf_id
 where ri.id=p_recebimento_item_id and ri.empresa_id=p_empresa_id
  and cr.empresa_id=p_empresa_id and ci.empresa_id=p_empresa_id and cn.empresa_id=p_empresa_id
 for update of ri;
 if not found then raise exception 'Item da conferência não encontrado';end if;
 if v_nf.status_recebimento<>'concluido' or v_nf.status_nf='cancelada'
  then raise exception 'A conferência da NF não está concluída';end if;
 select cl.id,cl.empresa_id,cl.item_id,cl.carrinho_id,cl.quantidade_obra,
  cl.quantidade_estoque,cl.recebido_obra,cl.recebido_estoque,
  c.fornecedor_id,c.status as status_carrinho,c.pedido_emitido_em,
  si.produto_id,si.destino,si.status as status_item,si.solicitacao_id
 into v_linha
 from public.compras_carrinho_itens cl
 join public.compras_carrinhos c on c.id=cl.carrinho_id
 join public.compras_solicitacao_itens si on si.id=cl.item_id
 where cl.id=p_carrinho_item_id and cl.empresa_id=p_empresa_id
  and c.empresa_id=p_empresa_id and si.empresa_id=p_empresa_id
 for update of cl;
 if not found then raise exception 'Linha do pedido não encontrada';end if;
 if v_linha.status_carrinho not in ('pedido_emitido','aguardando_entrega','recebido_parcial','recebido')
  or v_linha.pedido_emitido_em is null then raise exception 'Pedido ainda não comprado';end if;
 if v_linha.status_item<>'ativo' then raise exception 'Item cancelado ou com exclusão pendente';end if;
 if v_nf.produto_nf is null or v_nf.produto_id is null or v_linha.produto_id is null
  or v_nf.produto_nf<>v_linha.produto_id or v_nf.produto_id<>v_linha.produto_id
  then raise exception 'Produtos diferentes ou sem identificação validada';end if;
 if v_nf.fornecedor_id is null or v_nf.fornecedor_id<>v_linha.fornecedor_id
  then raise exception 'Fornecedor da NF diferente do carrinho';end if;
 if v_linha.destino='estoque' and p_quantidade_obra>0
  then raise exception 'Material solicitado para estoque não pode ser atribuído à obra';end if;
 if exists(select 1 from public.compras_recebimento_destinos
  where recebimento_item_id=p_recebimento_item_id and carrinho_item_id=p_carrinho_item_id)
  then raise exception 'Este vínculo já foi registrado: não duplica recebimento';end if;
 v_restante_obra:=v_linha.quantidade_obra-v_linha.recebido_obra;
 v_restante_estoque:=v_linha.quantidade_estoque-v_linha.recebido_estoque;
 if p_quantidade_obra>v_restante_obra+0.000001 or p_quantidade_estoque>v_restante_estoque+0.000001
  then raise exception 'Quantidade excede o saldo a receber do pedido';end if;
 -- Movimento existente em unidade do estoque (após conversão e exclusão de avarias).
 select coalesce(sum(m.quantidade),0) into v_movimentado
 from public.estoque_movimentos m
 where m.empresa_id=p_empresa_id and m.recebimento_item_id=p_recebimento_item_id
  and m.origem_tipo='recebimento_nf' and m.tipo='entrada' and m.produto_id=v_linha.produto_id;
 if v_movimentado<=0 then raise exception 'Aguarde a entrada física no estoque pela conferência da NF';end if;
 select coalesce(sum(d.quantidade_obra+d.quantidade_estoque),0) into v_alocado
 from public.compras_recebimento_destinos d
 where d.empresa_id=p_empresa_id and d.recebimento_item_id=p_recebimento_item_id;
 if v_alocado+p_quantidade_obra+p_quantidade_estoque>v_movimentado+0.000001
  then raise exception 'Distribuição excede a quantidade fisicamente recebida e aproveitável';end if;
 insert into public.compras_recebimento_destinos(empresa_id,recebimento_item_id,carrinho_item_id,
 quantidade_obra,quantidade_estoque,usuario_id)
 values(p_empresa_id,p_recebimento_item_id,p_carrinho_item_id,
 p_quantidade_obra,p_quantidade_estoque,p_usuario_id) returning id into v_id;
 update public.compras_carrinho_itens set
  recebido_obra=recebido_obra+p_quantidade_obra,
  recebido_estoque=recebido_estoque+p_quantidade_estoque,
  atualizado_por_id=p_usuario_id
 where id=p_carrinho_item_id and empresa_id=p_empresa_id;
 select bool_and(recebido_obra>=quantidade_obra and recebido_estoque>=quantidade_estoque)
 into v_pedido_completo from public.compras_carrinho_itens
 where empresa_id=p_empresa_id and carrinho_id=v_linha.carrinho_id;
 v_status:=case when v_pedido_completo then 'recebido' else 'recebido_parcial' end;
 update public.compras_carrinhos set status=v_status,
  recebido_em=case when v_pedido_completo then now() else null end,
  atualizado_por_id=p_usuario_id,updated_at=now()
 where id=v_linha.carrinho_id and empresa_id=p_empresa_id;
 -- Um pedido pode conter outras obras, estoque e vários fornecedores.
 -- Só encerrar a solicitação se cada linha ATIVA estiver integralmente atendida
 -- e não existir carrinho em rascunho para essas linhas.
 select case when not exists(
   select 1 from public.compras_solicitacao_itens si
   where si.empresa_id=p_empresa_id and si.solicitacao_id=v_linha.solicitacao_id
    and si.status='ativo' and (
     not exists(select 1 from public.compras_carrinho_itens ci
       join public.compras_carrinhos c on c.id=ci.carrinho_id
       where ci.item_id=si.id and ci.empresa_id=p_empresa_id and c.status<>'cancelado')
     or exists(select 1 from public.compras_carrinho_itens ci
       join public.compras_carrinhos c on c.id=ci.carrinho_id
       where ci.item_id=si.id and ci.empresa_id=p_empresa_id and c.status<>'cancelado'
       and (ci.recebido_obra<ci.quantidade_obra or ci.recebido_estoque<ci.quantidade_estoque))
     or (si.destino='obra' and
       (select coalesce(sum(ci.recebido_obra),0) from public.compras_carrinho_itens ci
         join public.compras_carrinhos c on c.id=ci.carrinho_id
         where ci.item_id=si.id and ci.empresa_id=p_empresa_id and c.status<>'cancelado')
         < coalesce(si.quantidade_necessaria,0))
     or (si.destino='estoque' and
       (select coalesce(sum(ci.recebido_estoque),0) from public.compras_carrinho_itens ci
        join public.compras_carrinhos c on c.id=ci.carrinho_id
        where ci.item_id=si.id and ci.empresa_id=p_empresa_id and c.status<>'cancelado') <=0)
    )
 ) then 'recebido' else 'recebido_parcial' end into v_solicitacao_status;
 if v_solicitacao_status is not null and exists(
   select 1 from public.compras_solicitacao_itens where solicitacao_id=v_linha.solicitacao_id and empresa_id=p_empresa_id and status='ativo') then
  update public.compras_solicitacoes set status=v_solicitacao_status,
   atualizado_por_id=p_usuario_id,updated_at=now()
  where id=v_linha.solicitacao_id and empresa_id=p_empresa_id
   and status in ('comprado','aguardando_entrega','recebido_parcial');
 end if;
 return jsonb_build_object('ok',true,'vinculoId',v_id,'statusPedido',v_status,
  'quantidadeObra',p_quantidade_obra,'quantidadeEstoque',p_quantidade_estoque,
  'movimentacaoEstoque',false,'avisoProducao',p_quantidade_obra>0);
end;$$;
revoke all on function public.registrar_destino_recebimento_compras(uuid,uuid,uuid,numeric,numeric,uuid) from public,anon,authenticated;
grant execute on function public.registrar_destino_recebimento_compras(uuid,uuid,uuid,numeric,numeric,uuid) to service_role;
commit;