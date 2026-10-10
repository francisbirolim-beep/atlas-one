drop index if exists public.uq_produtos_codigo_upper;

create unique index if not exists uq_produtos_empresa_codigo_upper
  on public.produtos (empresa_id, upper(codigo))
  where codigo is not null;