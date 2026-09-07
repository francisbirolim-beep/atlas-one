alter table public.fornecedores alter column empresa_id set not null;
alter table public.produtos alter column empresa_id set not null;
alter table public.produto_fornecedores alter column empresa_id set not null;
alter table public.fornecedor_documentos alter column empresa_id set not null;
alter table public.fornecedor_catalogo_itens alter column empresa_id set not null;
alter table public.produto_fornecedor_precos_historico alter column empresa_id set not null;
