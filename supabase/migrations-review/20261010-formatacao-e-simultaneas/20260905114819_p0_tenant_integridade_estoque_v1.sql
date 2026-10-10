create or replace function private.estoque_saldo_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid; v_local_empresa uuid;
begin
  select empresa_id into v_empresa from public.produtos where id=new.produto_id;
  select empresa_id into v_local_empresa from public.estoque_locais where id=new.local_id;
  if v_empresa is null or v_local_empresa is null then raise exception 'Produto/local sem empresa.'; end if;
  if v_empresa <> v_local_empresa then raise exception 'Produto e local pertencem a empresas diferentes.'; end if;
  if new.empresa_id is not null and new.empresa_id <> v_empresa then raise exception 'Empresa do saldo divergente.'; end if;
  new.empresa_id := v_empresa;
  return new;
end $$;

create or replace function private.estoque_reserva_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid; v_local_empresa uuid;
begin
  select empresa_id into v_empresa from public.produtos where id=new.produto_id;
  select empresa_id into v_local_empresa from public.estoque_locais where id=new.local_id;
  if v_empresa is null or v_local_empresa is null or v_empresa <> v_local_empresa then raise exception 'Produto/local da reserva com empresa inválida.'; end if;
  if new.cliente_id is not null and not exists(select 1 from public.clientes where id=new.cliente_id and empresa_id=v_empresa) then raise exception 'Cliente da reserva pertence a outra empresa.'; end if;
  if new.origem_tipo='venda_balcao' and new.origem_id is not null and not exists(select 1 from public.balcao_vendas where id=new.origem_id and empresa_id=v_empresa) then raise exception 'Venda da reserva pertence a outra empresa.'; end if;
  if new.criado_por_id is not null and not exists(select 1 from public.usuarios where id=new.criado_por_id and empresa_id=v_empresa) then raise exception 'Usuário da reserva pertence a outra empresa.'; end if;
  new.empresa_id := v_empresa;
  return new;
end $$;

create or replace function private.estoque_movimento_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.produtos where id=new.produto_id;
  if v_empresa is null then raise exception 'Produto do movimento sem empresa.'; end if;
  if new.local_origem_id is not null and not exists(select 1 from public.estoque_locais where id=new.local_origem_id and empresa_id=v_empresa) then raise exception 'Local de origem pertence a outra empresa.'; end if;
  if new.local_destino_id is not null and not exists(select 1 from public.estoque_locais where id=new.local_destino_id and empresa_id=v_empresa) then raise exception 'Local de destino pertence a outra empresa.'; end if;
  if new.nf_id is not null and not exists(select 1 from public.compras_nfs where id=new.nf_id and empresa_id=v_empresa) then raise exception 'NF pertence a outra empresa.'; end if;
  if new.recebimento_id is not null and not exists(select 1 from public.compras_recebimentos where id=new.recebimento_id and empresa_id=v_empresa) then raise exception 'Recebimento pertence a outra empresa.'; end if;
  if new.criado_por_id is not null and not exists(select 1 from public.usuarios where id=new.criado_por_id and empresa_id=v_empresa) then raise exception 'Usuário do movimento pertence a outra empresa.'; end if;
  if new.origem_tipo='venda_balcao' and new.origem_id is not null and not exists(select 1 from public.balcao_vendas where id=new.origem_id and empresa_id=v_empresa) then raise exception 'Venda do movimento pertence a outra empresa.'; end if;
  new.empresa_id := v_empresa;
  return new;
end $$;

drop trigger if exists trg_estoque_saldo_empresa_guard on public.estoque_saldos;
create trigger trg_estoque_saldo_empresa_guard before insert or update of produto_id,local_id,empresa_id on public.estoque_saldos for each row execute function private.estoque_saldo_empresa_guard();
drop trigger if exists trg_estoque_reserva_empresa_guard on public.estoque_reservas;
create trigger trg_estoque_reserva_empresa_guard before insert or update of produto_id,local_id,cliente_id,origem_tipo,origem_id,criado_por_id,empresa_id on public.estoque_reservas for each row execute function private.estoque_reserva_empresa_guard();
drop trigger if exists trg_estoque_movimento_empresa_guard on public.estoque_movimentos;
create trigger trg_estoque_movimento_empresa_guard before insert or update of produto_id,local_origem_id,local_destino_id,nf_id,recebimento_id,criado_por_id,origem_tipo,origem_id,empresa_id on public.estoque_movimentos for each row execute function private.estoque_movimento_empresa_guard();

revoke all on function private.estoque_saldo_empresa_guard() from public;
revoke all on function private.estoque_reserva_empresa_guard() from public;
revoke all on function private.estoque_movimento_empresa_guard() from public;
