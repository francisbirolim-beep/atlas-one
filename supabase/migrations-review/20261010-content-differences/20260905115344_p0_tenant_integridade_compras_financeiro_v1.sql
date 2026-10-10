create or replace function private.compras_necessidade_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid;
begin
  if new.criado_por_id is not null then select empresa_id into v_empresa from public.usuarios where id=new.criado_por_id; end if;
  if v_empresa is null and new.responsavel_id is not null then select empresa_id into v_empresa from public.usuarios where id=new.responsavel_id; end if;
  if v_empresa is null and new.cliente_id is not null then select empresa_id into v_empresa from public.clientes where id=new.cliente_id; end if;
  if v_empresa is null and new.obra_id is not null then select empresa_id into v_empresa from public.obras where id=new.obra_id; end if;
  if v_empresa is null and new.produto_id is not null then select empresa_id into v_empresa from public.produtos where id=new.produto_id; end if;
  if v_empresa is null then v_empresa := private.current_empresa_id(); end if;
  if v_empresa is null then raise exception 'Não foi possível determinar a empresa da necessidade de compra.'; end if;
  if new.empresa_id is not null and new.empresa_id <> v_empresa then raise exception 'Empresa da necessidade divergente.'; end if;
  if new.cliente_id is not null and not exists(select 1 from public.clientes where id=new.cliente_id and empresa_id=v_empresa) then raise exception 'Cliente da necessidade pertence a outra empresa.'; end if;
  if new.obra_id is not null and not exists(select 1 from public.obras where id=new.obra_id and empresa_id=v_empresa) then raise exception 'Obra da necessidade pertence a outra empresa.'; end if;
  if new.produto_id is not null and not exists(select 1 from public.produtos where id=new.produto_id and empresa_id=v_empresa) then raise exception 'Produto da necessidade pertence a outra empresa.'; end if;
  if new.responsavel_id is not null and not exists(select 1 from public.usuarios where id=new.responsavel_id and empresa_id=v_empresa) then raise exception 'Responsável da necessidade pertence a outra empresa.'; end if;
  new.empresa_id := v_empresa;
  return new;
end $$;

create or replace function private.compras_cotacao_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.compras_necessidades where id=new.necessidade_id;
  if v_empresa is null then raise exception 'Necessidade sem empresa.'; end if;
  if not exists(select 1 from public.fornecedores where id=new.fornecedor_id and empresa_id=v_empresa) then raise exception 'Fornecedor da cotação pertence a outra empresa.'; end if;
  if new.criado_por_id is not null and not exists(select 1 from public.usuarios where id=new.criado_por_id and empresa_id=v_empresa) then raise exception 'Usuário da cotação pertence a outra empresa.'; end if;
  if new.empresa_id is not null and new.empresa_id <> v_empresa then raise exception 'Empresa da cotação divergente.'; end if;
  new.empresa_id := v_empresa;
  return new;
end $$;

create or replace function private.compras_nf_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid;
begin
  if new.criado_por_id is not null then select empresa_id into v_empresa from public.usuarios where id=new.criado_por_id; end if;
  if v_empresa is null and new.fornecedor_id is not null then select empresa_id into v_empresa from public.fornecedores where id=new.fornecedor_id; end if;
  if v_empresa is null then v_empresa := private.current_empresa_id(); end if;
  if v_empresa is null then raise exception 'Não foi possível determinar a empresa da NF.'; end if;
  if new.fornecedor_id is not null and not exists(select 1 from public.fornecedores where id=new.fornecedor_id and empresa_id=v_empresa) then raise exception 'Fornecedor da NF pertence a outra empresa.'; end if;
  if new.confirmado_por_id is not null and not exists(select 1 from public.usuarios where id=new.confirmado_por_id and empresa_id=v_empresa) then raise exception 'Confirmador da NF pertence a outra empresa.'; end if;
  new.empresa_id := v_empresa;
  return new;
end $$;

create or replace function private.compras_nf_item_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.compras_nfs where id=new.nf_id;
  if v_empresa is null then raise exception 'NF sem empresa.'; end if;
  if new.produto_id is not null and not exists(select 1 from public.produtos where id=new.produto_id and empresa_id=v_empresa) then raise exception 'Produto do item de NF pertence a outra empresa.'; end if;
  new.empresa_id := v_empresa;
  return new;
end $$;

create or replace function private.compras_recebimento_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.compras_nfs where id=new.nf_id;
  if v_empresa is null then raise exception 'NF do recebimento sem empresa.'; end if;
  if new.recebido_por_id is not null and not exists(select 1 from public.usuarios where id=new.recebido_por_id and empresa_id=v_empresa) then raise exception 'Recebedor pertence a outra empresa.'; end if;
  new.empresa_id := v_empresa;
  return new;
end $$;

create or replace function private.compras_recebimento_item_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.compras_recebimentos where id=new.recebimento_id;
  if v_empresa is null then raise exception 'Recebimento sem empresa.'; end if;
  if not exists(select 1 from public.compras_nf_itens where id=new.nf_item_id and empresa_id=v_empresa) then raise exception 'Item de NF pertence a outra empresa.'; end if;
  if new.produto_id is not null and not exists(select 1 from public.produtos where id=new.produto_id and empresa_id=v_empresa) then raise exception 'Produto do recebimento pertence a outra empresa.'; end if;
  new.empresa_id := v_empresa;
  return new;
end $$;

create or replace function private.fornecedor_documento_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from public.fornecedores where id=new.fornecedor_id;
  if v_empresa is null then raise exception 'Fornecedor sem empresa.'; end if;
  if new.criado_por_id is not null and not exists(select 1 from public.usuarios where id=new.criado_por_id and empresa_id=v_empresa) then raise exception 'Usuário do documento pertence a outra empresa.'; end if;
  new.empresa_id := v_empresa;
  return new;
end $$;

create or replace function private.produto_fornecedor_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare vp uuid; vf uuid;
begin
  select empresa_id into vp from public.produtos where id=new.produto_id;
  select empresa_id into vf from public.fornecedores where id=new.fornecedor_id;
  if vp is null or vf is null or vp <> vf then raise exception 'Produto e fornecedor pertencem a empresas diferentes.'; end if;
  if new.criado_por_id is not null and not exists(select 1 from public.usuarios where id=new.criado_por_id and empresa_id=vp) then raise exception 'Usuário do vínculo pertence a outra empresa.'; end if;
  new.empresa_id := vp;
  return new;
end $$;

create or replace function private.conta_pagar_empresa_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_empresa uuid;
begin
  if new.nf_id is not null then select empresa_id into v_empresa from public.compras_nfs where id=new.nf_id; end if;
  if v_empresa is null and new.fornecedor_id is not null then select empresa_id into v_empresa from public.fornecedores where id=new.fornecedor_id; end if;
  if v_empresa is null and new.criado_por_id is not null then select empresa_id into v_empresa from public.usuarios where id=new.criado_por_id; end if;
  if v_empresa is null then v_empresa := private.current_empresa_id(); end if;
  if v_empresa is null then raise exception 'Não foi possível determinar a empresa da conta a pagar.'; end if;
  if new.fornecedor_id is not null and not exists(select 1 from public.fornecedores where id=new.fornecedor_id and empresa_id=v_empresa) then raise exception 'Fornecedor da conta a pagar pertence a outra empresa.'; end if;
  new.empresa_id := v_empresa;
  return new;
end $$;

drop trigger if exists trg_compras_necessidade_empresa_guard on public.compras_necessidades;
create trigger trg_compras_necessidade_empresa_guard before insert or update of produto_id,cliente_id,obra_id,criado_por_id,responsavel_id,empresa_id on public.compras_necessidades for each row execute function private.compras_necessidade_empresa_guard();
drop trigger if exists trg_compras_cotacao_empresa_guard on public.compras_cotacoes;
create trigger trg_compras_cotacao_empresa_guard before insert or update of necessidade_id,fornecedor_id,criado_por_id,empresa_id on public.compras_cotacoes for each row execute function private.compras_cotacao_empresa_guard();
drop trigger if exists trg_compras_nf_empresa_guard on public.compras_nfs;
create trigger trg_compras_nf_empresa_guard before insert or update of fornecedor_id,criado_por_id,confirmado_por_id,empresa_id on public.compras_nfs for each row execute function private.compras_nf_empresa_guard();
drop trigger if exists trg_compras_nf_item_empresa_guard on public.compras_nf_itens;
create trigger trg_compras_nf_item_empresa_guard before insert or update of nf_id,produto_id,empresa_id on public.compras_nf_itens for each row execute function private.compras_nf_item_empresa_guard();
drop trigger if exists trg_compras_recebimento_empresa_guard on public.compras_recebimentos;
create trigger trg_compras_recebimento_empresa_guard before insert or update of nf_id,recebido_por_id,empresa_id on public.compras_recebimentos for each row execute function private.compras_recebimento_empresa_guard();
drop trigger if exists trg_compras_recebimento_item_empresa_guard on public.compras_recebimento_itens;
create trigger trg_compras_recebimento_item_empresa_guard before insert or update of recebimento_id,nf_item_id,produto_id,empresa_id on public.compras_recebimento_itens for each row execute function private.compras_recebimento_item_empresa_guard();
drop trigger if exists trg_fornecedor_documento_empresa_guard on public.fornecedor_documentos;
create trigger trg_fornecedor_documento_empresa_guard before insert or update of fornecedor_id,criado_por_id,empresa_id on public.fornecedor_documentos for each row execute function private.fornecedor_documento_empresa_guard();
drop trigger if exists trg_produto_fornecedor_empresa_guard on public.produto_fornecedores;
create trigger trg_produto_fornecedor_empresa_guard before insert or update of produto_id,fornecedor_id,criado_por_id,empresa_id on public.produto_fornecedores for each row execute function private.produto_fornecedor_empresa_guard();
drop trigger if exists trg_conta_pagar_empresa_guard on public.financeiro_contas_pagar;
create trigger trg_conta_pagar_empresa_guard before insert or update of nf_id,fornecedor_id,criado_por_id,empresa_id on public.financeiro_contas_pagar for each row execute function private.conta_pagar_empresa_guard();

revoke all on function private.compras_necessidade_empresa_guard() from public;
revoke all on function private.compras_cotacao_empresa_guard() from public;
revoke all on function private.compras_nf_empresa_guard() from public;
revoke all on function private.compras_nf_item_empresa_guard() from public;
revoke all on function private.compras_recebimento_empresa_guard() from public;
revoke all on function private.compras_recebimento_item_empresa_guard() from public;
revoke all on function private.fornecedor_documento_empresa_guard() from public;
revoke all on function private.produto_fornecedor_empresa_guard() from public;
revoke all on function private.conta_pagar_empresa_guard() from public;
