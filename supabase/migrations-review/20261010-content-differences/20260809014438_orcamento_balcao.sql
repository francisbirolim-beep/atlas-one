alter table public.produtos add column if not exists foto_url text;
alter table public.orcamentos add column if not exists numero serial;
alter table public.orcamentos add column if not exists itens_balcao jsonb not null default '[]'::jsonb;
alter table public.orcamentos add column if not exists condicoes text;;
