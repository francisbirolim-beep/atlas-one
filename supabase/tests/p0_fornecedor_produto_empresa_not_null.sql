do $$
declare
  v_total integer;
begin
  select count(*) into v_total
  from information_schema.columns
  where table_schema='public'
    and table_name in (
      'fornecedores',
      'produtos',
      'produto_fornecedores',
      'fornecedor_documentos',
      'fornecedor_catalogo_itens',
      'produto_fornecedor_precos_historico'
    )
    and column_name='empresa_id'
    and is_nullable='NO';

  if v_total <> 6 then
    raise exception 'P0 tenant regression: esperado empresa_id NOT NULL em 6 tabelas de fornecedores/produtos, encontrado %', v_total;
  end if;
end $$;
