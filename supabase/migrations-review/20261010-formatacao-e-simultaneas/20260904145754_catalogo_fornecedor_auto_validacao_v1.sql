create or replace function public.auto_validar_produto_catalogo_fornecedor()
returns trigger
language plpgsql
as $$
begin
  if new.origem = 'catalogo_fornecedor' and nullif(trim(coalesce(new.codigo,'')), '') is not null then
    new.ativo := true;
    new.status_validacao := 'validado';
    new.validado_em := coalesce(new.validado_em, now());
    new.validado_por_id := coalesce(new.validado_por_id, new.criado_por_id);
    new.validado_por_nome := coalesce(new.validado_por_nome, new.criado_por_nome, 'Importação automática de catálogo');
    new.observacao_validacao := coalesce(new.observacao_validacao, 'Validado automaticamente a partir de catálogo de fornecedor com código identificado.');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_validar_produto_catalogo_fornecedor on public.produtos;
create trigger trg_auto_validar_produto_catalogo_fornecedor
before insert or update of origem, codigo, ativo, status_validacao on public.produtos
for each row
execute function public.auto_validar_produto_catalogo_fornecedor();

create or replace function public.auto_vincular_item_catalogo_validado()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'criado_pendente' and new.produto_id is not null then
    if exists (
      select 1
      from public.produtos p
      where p.id = new.produto_id
        and p.ativo = true
        and p.status_validacao = 'validado'
        and nullif(trim(coalesce(p.codigo,'')), '') is not null
    ) then
      new.status := 'vinculado';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_vincular_item_catalogo_validado on public.fornecedor_catalogo_itens;
create trigger trg_auto_vincular_item_catalogo_validado
before insert or update of status, produto_id on public.fornecedor_catalogo_itens
for each row
execute function public.auto_vincular_item_catalogo_validado();
