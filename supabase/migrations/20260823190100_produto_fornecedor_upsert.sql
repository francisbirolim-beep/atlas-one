create unique index if not exists uq_produto_fornecedor_codigo_raw
  on public.produto_fornecedores(fornecedor_id, codigo_fornecedor);
