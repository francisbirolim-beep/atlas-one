create or replace function private.balcao_venda_empresa_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.usuarios where id = new.vendedor_id;
  if v_empresa is null then raise exception 'Vendedor sem empresa vinculada.'; end if;
  if new.empresa_id is not null and new.empresa_id <> v_empresa then raise exception 'Empresa da venda divergente do vendedor.'; end if;
  new.empresa_id := v_empresa;
  if new.cliente_id is not null and not exists (select 1 from public.clientes where id=new.cliente_id and empresa_id=v_empresa) then raise exception 'Cliente pertence a outra empresa.'; end if;
  if new.caixa_id is not null and not exists (select 1 from public.balcao_caixas where id=new.caixa_id and empresa_id=v_empresa) then raise exception 'Caixa pertence a outra empresa.'; end if;
  if new.unidade_id is not null and not exists (select 1 from public.unidades_operacionais where id=new.unidade_id and empresa_id=v_empresa) then raise exception 'Unidade pertence a outra empresa.'; end if;
  if new.local_estoque_id is not null and not exists (select 1 from public.estoque_locais where id=new.local_estoque_id and empresa_id=v_empresa) then raise exception 'Local de estoque pertence a outra empresa.'; end if;
  return new;
end $$;

create or replace function private.balcao_item_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.balcao_vendas where id=new.venda_id;
  if v_empresa is null then raise exception 'Venda sem empresa.'; end if;
  new.empresa_id := v_empresa;
  if not exists (select 1 from public.produtos where id=new.produto_id and empresa_id=v_empresa) then raise exception 'Produto pertence a outra empresa.'; end if;
  if new.local_origem_id is not null and not exists (select 1 from public.estoque_locais where id=new.local_origem_id and empresa_id=v_empresa) then raise exception 'Local de origem pertence a outra empresa.'; end if;
  return new;
end $$;

create or replace function private.balcao_filho_venda_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.balcao_vendas where id=new.venda_id;
  if v_empresa is null then raise exception 'Venda sem empresa.'; end if;
  new.empresa_id := v_empresa;
  return new;
end $$;

create or replace function private.balcao_caixa_movimento_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.balcao_caixas where id=new.caixa_id;
  if v_empresa is null then raise exception 'Caixa sem empresa.'; end if;
  new.empresa_id := v_empresa;
  if new.venda_id is not null and not exists (select 1 from public.balcao_vendas where id=new.venda_id and empresa_id=v_empresa) then raise exception 'Venda pertence a outra empresa.'; end if;
  return new;
end $$;

create or replace function private.financeiro_receber_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid;
begin
  if new.venda_balcao_id is not null then select empresa_id into v_empresa from public.balcao_vendas where id=new.venda_balcao_id; end if;
  if v_empresa is null and new.venda_obra_id is not null then select empresa_id into v_empresa from public.vendas_obras where id=new.venda_obra_id; end if;
  if v_empresa is null and new.orcamento_id is not null then select empresa_id into v_empresa from public.orcamentos where id=new.orcamento_id; end if;
  if v_empresa is null and new.cliente_id is not null then select empresa_id into v_empresa from public.clientes where id=new.cliente_id; end if;
  if v_empresa is null then select empresa_id into v_empresa from public.usuarios where id=new.criado_por_id; end if;
  if v_empresa is null then v_empresa := private.current_empresa_id(); end if;
  if v_empresa is null then raise exception 'Não foi possível determinar a empresa da conta a receber.'; end if;
  if new.empresa_id is not null and new.empresa_id <> v_empresa then raise exception 'Empresa da conta a receber divergente.'; end if;
  new.empresa_id := v_empresa;
  return new;
end $$;

drop trigger if exists trg_balcao_venda_empresa_guard on public.balcao_vendas;
create trigger trg_balcao_venda_empresa_guard before insert or update of vendedor_id,cliente_id,caixa_id,unidade_id,local_estoque_id,empresa_id on public.balcao_vendas for each row execute function private.balcao_venda_empresa_guard();
drop trigger if exists trg_balcao_item_empresa_guard on public.balcao_venda_itens;
create trigger trg_balcao_item_empresa_guard before insert or update of venda_id,produto_id,local_origem_id,empresa_id on public.balcao_venda_itens for each row execute function private.balcao_item_empresa_guard();
drop trigger if exists trg_balcao_pagamento_empresa_guard on public.balcao_pagamentos;
create trigger trg_balcao_pagamento_empresa_guard before insert or update of venda_id,empresa_id on public.balcao_pagamentos for each row execute function private.balcao_filho_venda_empresa_guard();
drop trigger if exists trg_balcao_evento_empresa_guard on public.balcao_venda_eventos;
create trigger trg_balcao_evento_empresa_guard before insert or update of venda_id,empresa_id on public.balcao_venda_eventos for each row execute function private.balcao_filho_venda_empresa_guard();
drop trigger if exists trg_balcao_caixa_mov_empresa_guard on public.balcao_caixa_movimentos;
create trigger trg_balcao_caixa_mov_empresa_guard before insert or update of caixa_id,venda_id,empresa_id on public.balcao_caixa_movimentos for each row execute function private.balcao_caixa_movimento_empresa_guard();
drop trigger if exists trg_financeiro_receber_empresa_guard on public.financeiro_contas_receber;
create trigger trg_financeiro_receber_empresa_guard before insert or update of venda_balcao_id,venda_obra_id,orcamento_id,cliente_id,criado_por_id,empresa_id on public.financeiro_contas_receber for each row execute function private.financeiro_receber_empresa_guard();

revoke all on function private.balcao_venda_empresa_guard() from public;
revoke all on function private.balcao_item_empresa_guard() from public;
revoke all on function private.balcao_filho_venda_empresa_guard() from public;
revoke all on function private.balcao_caixa_movimento_empresa_guard() from public;
revoke all on function private.financeiro_receber_empresa_guard() from public;
