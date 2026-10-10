alter table public.produto_fornecedores
  add constraint uq_produto_fornecedor_codigo_raw
  unique (fornecedor_id, codigo_fornecedor);
