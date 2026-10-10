alter table public.cliente_documentos
  add column if not exists venda_obra_id uuid references public.vendas_obras(id) on delete set null;

create index if not exists cliente_documentos_venda_idx
  on public.cliente_documentos(empresa_id,venda_obra_id,created_at desc)
  where venda_obra_id is not null;