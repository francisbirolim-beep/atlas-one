-- Associação auditável entre item de NF e necessidade/pedido de compra.
-- Não movimenta estoque e não altera o Kanban. Aplicação em produção depende de aprovação.
begin;

create table if not exists public.compras_nf_pedidos_vinculos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  nf_item_id uuid not null references public.compras_nf_itens(id) on delete restrict,
  necessidade_id uuid not null references public.compras_necessidades(id) on delete restrict,
  quantidade numeric not null check (quantidade > 0),
  criado_por_id uuid references auth.users(id) on delete set null,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  unique (nf_item_id, necessidade_id)
);
create index if not exists compras_nf_pedidos_vinculos_empresa_idx
  on public.compras_nf_pedidos_vinculos (empresa_id, necessidade_id);
create index if not exists compras_nf_pedidos_vinculos_nf_idx
  on public.compras_nf_pedidos_vinculos (empresa_id, nf_item_id);

create or replace function private.guard_compras_nf_pedido_vinculo()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_nf record;
  v_pedido record;
  v_usado_nf numeric;
  v_usado_pedido numeric;
begin
  select ci.empresa_id,ci.produto_id,ci.unidade,ci.quantidade,
         cn.fornecedor_id,cn.status
  into v_nf
  from public.compras_nf_itens ci
  join public.compras_nfs cn on cn.id=ci.nf_id
  where ci.id=new.nf_item_id and cn.empresa_id=ci.empresa_id
  for update of ci;
  if not found or new.empresa_id is distinct from v_nf.empresa_id then
    raise exception 'Item da NF não pertence à empresa';
  end if;
  if v_nf.status = 'cancelada' then
    raise exception 'NF cancelada não admite vínculo';
  end if;

  select empresa_id,produto_id,unidade,quantidade,status
  into v_pedido
  from public.compras_necessidades
  where id=new.necessidade_id
  for update;
  if not found or new.empresa_id is distinct from v_pedido.empresa_id then
    raise exception 'Pedido não pertence à empresa';
  end if;
  if v_pedido.status not in ('aprovado','pedido_emitido','aguardando_entrega','recebido') then
    raise exception 'O pedido ainda não foi aprovado ou foi cancelado';
  end if;
  if not exists (
    select 1 from public.compras_cotacoes c
    where c.empresa_id=new.empresa_id and c.necessidade_id=new.necessidade_id
      and c.selecionada=true and c.fornecedor_id=v_nf.fornecedor_id
  ) then
    raise exception 'O fornecedor da NF não corresponde à cotação selecionada';
  end if;
  if v_nf.produto_id is not null and v_pedido.produto_id is not null
     and v_nf.produto_id <> v_pedido.produto_id then
    raise exception 'Produtos diferentes: revise o vínculo';
  end if;
  -- Somente uma mesma unidade por enquanto: conversões são tratadas na entrada da NF.
  if upper(btrim(coalesce(v_nf.unidade,''))) <> upper(btrim(coalesce(v_pedido.unidade,''))) then
    raise exception 'Unidades diferentes: é necessário validar a conversão antes de vincular';
  end if;
  select coalesce(sum(quantidade),0) into v_usado_nf
  from public.compras_nf_pedidos_vinculos
  where nf_item_id=new.nf_item_id and id <> new.id;
  select coalesce(sum(quantidade),0) into v_usado_pedido
  from public.compras_nf_pedidos_vinculos
  where necessidade_id=new.necessidade_id and id <> new.id;
  if v_usado_nf + new.quantidade > v_nf.quantidade + 0.000001 then
    raise exception 'Quantidade vinculada excede a quantidade do item na NF';
  end if;
  if v_usado_pedido + new.quantidade > v_pedido.quantidade + 0.000001 then
    raise exception 'Quantidade vinculada excede o pedido de compra';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_compras_nf_pedido_guard on public.compras_nf_pedidos_vinculos;
create trigger trg_compras_nf_pedido_guard
before insert or update on public.compras_nf_pedidos_vinculos
for each row execute function private.guard_compras_nf_pedido_vinculo();

create or replace function private.guard_compras_nf_pedido_desvinculo()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists (
    select 1 from public.compras_recebimento_itens ri
    join public.compras_recebimentos r on r.id=ri.recebimento_id
    where ri.nf_item_id=old.nf_item_id and r.status <> 'cancelado'
      and ri.quantidade_recebida > 0
  ) then
    raise exception 'Já houve recebimento físico; o vínculo não pode ser excluído sem estorno auditado';
  end if;
  return old;
end;
$$;
drop trigger if exists trg_compras_nf_pedido_desvinculo on public.compras_nf_pedidos_vinculos;
create trigger trg_compras_nf_pedido_desvinculo
before delete on public.compras_nf_pedidos_vinculos
for each row execute function private.guard_compras_nf_pedido_desvinculo();

alter table public.compras_nf_pedidos_vinculos enable row level security;
revoke all on public.compras_nf_pedidos_vinculos from public,anon,authenticated;
grant select,insert,update,delete on public.compras_nf_pedidos_vinculos to service_role;
revoke all on function private.guard_compras_nf_pedido_vinculo() from public,anon,authenticated;
revoke all on function private.guard_compras_nf_pedido_desvinculo() from public,anon,authenticated;

commit;
