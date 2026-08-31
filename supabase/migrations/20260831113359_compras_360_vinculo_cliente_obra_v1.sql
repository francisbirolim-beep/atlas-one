-- Compras 360: vincular necessidade a Cliente/Obra ou Estoque.
-- Mantem obra_referencia (texto livre) por compatibilidade com registros antigos.

do $$ begin
  alter table public.compras_necessidades
    add column destino text check (destino in ('obra', 'estoque'));
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.compras_necessidades
    add column cliente_id uuid references public.clientes(id) on delete set null;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.compras_necessidades
    add column cliente_nome text;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.compras_necessidades
    add column obra_id uuid references public.obras(id) on delete set null;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table public.compras_necessidades
    add column obra_nome text;
exception when duplicate_column then null; end $$;

create index if not exists compras_necessidades_cliente_idx
  on public.compras_necessidades(cliente_id);
create index if not exists compras_necessidades_obra_idx
  on public.compras_necessidades(obra_id);
