-- Atlas One: a identidade do produto e tenant-aware.
-- O indice anterior tornava o codigo unico globalmente, apesar da tabela ser multiempresa.
drop index if exists public.uq_produtos_codigo_upper;

create unique index if not exists uq_produtos_empresa_codigo_upper
  on public.produtos (empresa_id, upper(codigo))
  where codigo is not null;

[executed on device: MacBook-Air-de-Francis.local (d826e938-c59b-466a-8dd2-7429b4a59e10)]