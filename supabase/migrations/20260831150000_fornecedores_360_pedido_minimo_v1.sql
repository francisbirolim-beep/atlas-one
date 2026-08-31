-- Fornecedor 360: pedido mínimo e prazo de entrega no cadastro do fornecedor.

do $$ begin
  alter table public.fornecedores
    add column pedido_minimo numeric;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.fornecedores
    add column prazo_entrega_dias integer;
exception when duplicate_column then null; end $$;
