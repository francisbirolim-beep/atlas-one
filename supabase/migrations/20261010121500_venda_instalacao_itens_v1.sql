create table if not exists public.venda_instalacao_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default private.current_empresa_id(),
  venda_obra_id uuid not null references public.vendas_obras(id) on delete cascade,
  obra_id uuid null references public.obras(id) on delete cascade,
  cliente_id uuid null references public.clientes(id) on delete cascade,
  orcamento_id uuid null references public.orcamentos(id) on delete set null,
  item_ref text not null,
  ambiente text null,
  descricao text null,
  quantidade numeric not null default 1 check (quantidade >= 0),
  quantidade_instalada numeric not null default 0 check (quantidade_instalada >= 0),
  status text not null default 'pendente' check (status in ('pendente','em_instalacao','instalado','pendencia')),
  checklist jsonb not null default '{"nivelamento":false,"vedacao":false,"acabamento":false,"limpeza":false}'::jsonb,
  pendencia text null,
  observacoes text null,
  atualizado_por_id uuid null,
  atualizado_por_nome text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venda_obra_id, item_ref)
);

create index if not exists venda_instalacao_itens_empresa_venda_idx
  on public.venda_instalacao_itens (empresa_id, venda_obra_id, status);

alter table public.venda_instalacao_itens enable row level security;

drop policy if exists venda_instalacao_itens_select_empresa on public.venda_instalacao_itens;
create policy venda_instalacao_itens_select_empresa
  on public.venda_instalacao_itens for select
  using (empresa_id = private.current_empresa_id());

drop policy if exists venda_instalacao_itens_insert_empresa on public.venda_instalacao_itens;
create policy venda_instalacao_itens_insert_empresa
  on public.venda_instalacao_itens for insert
  with check (empresa_id = private.current_empresa_id());

drop policy if exists venda_instalacao_itens_update_empresa on public.venda_instalacao_itens;
create policy venda_instalacao_itens_update_empresa
  on public.venda_instalacao_itens for update
  using (empresa_id = private.current_empresa_id())
  with check (empresa_id = private.current_empresa_id());

drop policy if exists venda_instalacao_itens_delete_empresa on public.venda_instalacao_itens;
create policy venda_instalacao_itens_delete_empresa
  on public.venda_instalacao_itens for delete
  using (empresa_id = private.current_empresa_id());

grant select, insert, update, delete on table public.venda_instalacao_itens to authenticated;

create or replace function public.venda_instalacao_itens_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_venda_instalacao_itens_touch on public.venda_instalacao_itens;
create trigger trg_venda_instalacao_itens_touch
before update on public.venda_instalacao_itens
for each row execute function public.venda_instalacao_itens_touch_updated_at();

revoke execute on function public.venda_instalacao_itens_touch_updated_at() from public, anon, authenticated;