create sequence if not exists public.balcao_orcamentos_numero_seq;

create table if not exists public.balcao_orcamentos (
  id uuid primary key,
  numero integer not null default nextval('public.balcao_orcamentos_numero_seq'::regclass),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cliente_id uuid null references public.clientes(id) on delete set null,
  cliente_nome text not null,
  cliente_whatsapp text null,
  cidade text null,
  origem text null,
  itens_balcao jsonb not null default '[]'::jsonb,
  condicoes text null,
  valor_estimado numeric null,
  status text not null default 'rascunho',
  criado_por_nome text null,
  criado_por_id uuid null
);

alter sequence public.balcao_orcamentos_numero_seq owned by public.balcao_orcamentos.numero;

create index if not exists idx_balcao_orcamentos_created_at on public.balcao_orcamentos(created_at desc);
create index if not exists idx_balcao_orcamentos_cliente_id on public.balcao_orcamentos(cliente_id);
create index if not exists idx_balcao_orcamentos_numero on public.balcao_orcamentos(numero);

alter table public.balcao_orcamentos enable row level security;

drop policy if exists balcao_orcamentos_select on public.balcao_orcamentos;
create policy balcao_orcamentos_select on public.balcao_orcamentos for select using (true);
drop policy if exists balcao_orcamentos_insert on public.balcao_orcamentos;
create policy balcao_orcamentos_insert on public.balcao_orcamentos for insert with check (true);
drop policy if exists balcao_orcamentos_update on public.balcao_orcamentos;
create policy balcao_orcamentos_update on public.balcao_orcamentos for update using (true) with check (true);
drop policy if exists balcao_orcamentos_delete on public.balcao_orcamentos;
create policy balcao_orcamentos_delete on public.balcao_orcamentos for delete using (true);

grant select, insert, update, delete on public.balcao_orcamentos to anon, authenticated;
grant usage, select on sequence public.balcao_orcamentos_numero_seq to anon, authenticated;

drop trigger if exists balcao_orcamentos_updated_at on public.balcao_orcamentos;
create trigger balcao_orcamentos_updated_at
before update on public.balcao_orcamentos
for each row execute function public.update_updated_at();

insert into public.balcao_orcamentos (
  id, numero, created_at, updated_at, cliente_id, cliente_nome, cliente_whatsapp,
  cidade, origem, itens_balcao, condicoes, valor_estimado, status, criado_por_nome, criado_por_id
)
select
  id, numero, coalesce(created_at, now()), coalesce(updated_at, created_at, now()), cliente_id,
  cliente_nome, cliente_whatsapp, cidade, origem, coalesce(itens_balcao, '[]'::jsonb),
  condicoes, valor_estimado, status, criado_por_nome, criado_por_id
from public.orcamentos
where modo_entrada = 'balcao'
on conflict (id) do nothing;

delete from public.orcamentos where modo_entrada = 'balcao';
