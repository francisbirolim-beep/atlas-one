create or replace function private.agente_memoria_empresa_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  if new.usuario_id is null then
    if new.empresa_id is null then
      raise exception 'Memória do agente sem empresa';
    end if;
    return new;
  end if;

  select u.empresa_id into v_empresa
  from public.usuarios u
  where u.id = new.usuario_id;

  if v_empresa is null then
    raise exception 'Usuário da memória sem empresa vinculada';
  end if;

  if new.empresa_id is null then
    new.empresa_id := v_empresa;
  elsif new.empresa_id is distinct from v_empresa then
    raise exception 'Memória do agente pertence a empresa diferente do usuário';
  end if;

  return new;
end;
$$;

create or replace function private.agente_conversa_empresa_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  select u.empresa_id into v_empresa
  from public.usuarios u
  where u.id = new.usuario_id;

  if v_empresa is null then
    raise exception 'Usuário da conversa sem empresa vinculada';
  end if;

  if new.empresa_id is null then
    new.empresa_id := v_empresa;
  elsif new.empresa_id is distinct from v_empresa then
    raise exception 'Conversa pertence a empresa diferente do usuário';
  end if;

  return new;
end;
$$;

create or replace function private.agente_mensagem_empresa_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  select c.empresa_id into v_empresa
  from public.agente_conversas c
  where c.id = new.conversa_id;

  if v_empresa is null then
    raise exception 'Conversa da mensagem não encontrada ou sem empresa';
  end if;

  if new.empresa_id is null then
    new.empresa_id := v_empresa;
  elsif new.empresa_id is distinct from v_empresa then
    raise exception 'Mensagem pertence a empresa diferente da conversa';
  end if;

  return new;
end;
$$;

create or replace function private.fornecedor_catalogo_item_empresa_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_fornecedor uuid;
  v_empresa_documento uuid;
  v_empresa_produto uuid;
begin
  select f.empresa_id into v_empresa_fornecedor
  from public.fornecedores f
  where f.id = new.fornecedor_id;

  if v_empresa_fornecedor is null then
    raise exception 'Fornecedor do item de catálogo não encontrado ou sem empresa';
  end if;

  select d.empresa_id into v_empresa_documento
  from public.fornecedor_documentos d
  where d.id = new.documento_id;

  if v_empresa_documento is null then
    raise exception 'Documento do item de catálogo não encontrado ou sem empresa';
  end if;

  if v_empresa_documento is distinct from v_empresa_fornecedor then
    raise exception 'Documento e fornecedor pertencem a empresas diferentes';
  end if;

  if new.produto_id is not null then
    select p.empresa_id into v_empresa_produto
    from public.produtos p
    where p.id = new.produto_id;

    if v_empresa_produto is null then
      raise exception 'Produto do item de catálogo não encontrado ou sem empresa';
    end if;

    if v_empresa_produto is distinct from v_empresa_fornecedor then
      raise exception 'Produto e fornecedor pertencem a empresas diferentes';
    end if;
  end if;

  if new.empresa_id is null then
    new.empresa_id := v_empresa_fornecedor;
  elsif new.empresa_id is distinct from v_empresa_fornecedor then
    raise exception 'Item de catálogo pertence a empresa diferente do fornecedor';
  end if;

  return new;
end;
$$;

create or replace function private.produto_fornecedor_preco_empresa_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_vinculo uuid;
  v_empresa_fornecedor uuid;
  v_empresa_produto uuid;
  v_empresa_documento uuid;
begin
  select pf.empresa_id into v_empresa_vinculo
  from public.produto_fornecedores pf
  where pf.id = new.produto_fornecedor_id;

  if v_empresa_vinculo is null then
    raise exception 'Vínculo produto-fornecedor não encontrado ou sem empresa';
  end if;

  select f.empresa_id into v_empresa_fornecedor
  from public.fornecedores f
  where f.id = new.fornecedor_id;

  select p.empresa_id into v_empresa_produto
  from public.produtos p
  where p.id = new.produto_id;

  if v_empresa_fornecedor is null or v_empresa_produto is null then
    raise exception 'Fornecedor ou produto do histórico não encontrado';
  end if;

  if v_empresa_fornecedor is distinct from v_empresa_vinculo
     or v_empresa_produto is distinct from v_empresa_vinculo then
    raise exception 'Histórico de preço referencia entidades de empresas diferentes';
  end if;

  if new.documento_origem_id is not null then
    select d.empresa_id into v_empresa_documento
    from public.fornecedor_documentos d
    where d.id = new.documento_origem_id;

    if v_empresa_documento is null or v_empresa_documento is distinct from v_empresa_vinculo then
      raise exception 'Documento do histórico pertence a empresa diferente';
    end if;
  end if;

  if new.empresa_id is null then
    new.empresa_id := v_empresa_vinculo;
  elsif new.empresa_id is distinct from v_empresa_vinculo then
    raise exception 'Histórico de preço pertence a empresa diferente do vínculo';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agente_memoria_empresa_guard on public.agente_memorias;
create trigger trg_agente_memoria_empresa_guard
before insert or update of usuario_id, empresa_id on public.agente_memorias
for each row execute function private.agente_memoria_empresa_guard();

drop trigger if exists trg_agente_conversa_empresa_guard on public.agente_conversas;
create trigger trg_agente_conversa_empresa_guard
before insert or update of usuario_id, empresa_id on public.agente_conversas
for each row execute function private.agente_conversa_empresa_guard();

drop trigger if exists trg_agente_mensagem_empresa_guard on public.agente_mensagens;
create trigger trg_agente_mensagem_empresa_guard
before insert or update of conversa_id, empresa_id on public.agente_mensagens
for each row execute function private.agente_mensagem_empresa_guard();

drop trigger if exists trg_fornecedor_catalogo_item_empresa_guard on public.fornecedor_catalogo_itens;
create trigger trg_fornecedor_catalogo_item_empresa_guard
before insert or update of fornecedor_id, documento_id, produto_id, empresa_id on public.fornecedor_catalogo_itens
for each row execute function private.fornecedor_catalogo_item_empresa_guard();

drop trigger if exists trg_produto_fornecedor_preco_empresa_guard on public.produto_fornecedor_precos_historico;
create trigger trg_produto_fornecedor_preco_empresa_guard
before insert or update of produto_fornecedor_id, fornecedor_id, produto_id, documento_origem_id, empresa_id on public.produto_fornecedor_precos_historico
for each row execute function private.produto_fornecedor_preco_empresa_guard();

revoke all on function private.agente_memoria_empresa_guard() from public, anon, authenticated;
revoke all on function private.agente_conversa_empresa_guard() from public, anon, authenticated;
revoke all on function private.agente_mensagem_empresa_guard() from public, anon, authenticated;
revoke all on function private.fornecedor_catalogo_item_empresa_guard() from public, anon, authenticated;
revoke all on function private.produto_fornecedor_preco_empresa_guard() from public, anon, authenticated;