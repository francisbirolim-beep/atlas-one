-- Atlas One — histórico de suprimentos W.Vetro isolado
-- Não altera estoque, compras, fornecedor ou financeiro oficiais do Atlas.

create table if not exists public.wvetro_historico_suprimentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,

  tipo_registro text not null check (tipo_registro in ('movimento_estoque','nota_entrada')),
  chave_externa text not null,

  data_referencia date null,
  data_lancamento timestamptz null,
  documento text null,

  pessoa_id_wvetro text null,
  pessoa_nome text null,
  produto_id_wvetro text null,
  produto_codigo text null,
  produto_descricao text null,
  produto_tipo text null,
  cor_nome text null,
  local_estoque text null,
  movimento_tipo text null,

  quantidade numeric null,
  valor_unitario numeric(14,5) null,
  valor_total numeric(14,5) null,

  nota_id_wvetro text null,
  nota_numero text null,
  nota_serie text null,
  chave_nfe text null,
  fornecedor_id_wvetro text null,
  fornecedor_nome text null,
  data_emissao date null,
  data_entrada date null,
  valor_contabil numeric(14,2) null,
  valor_produto numeric(14,2) null,
  valor_frete numeric(14,2) null,
  finalizada boolean null,

  resumo jsonb not null default '{}'::jsonb,
  payload_origem jsonb not null,
  dados_origem jsonb not null default '{}'::jsonb,
  somente_historico boolean not null default true check (somente_historico = true),

  importado_por_id uuid null references public.usuarios(id) on delete set null,
  importado_por_nome text null,
  importado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wvetro_historico_suprimentos_empresa_tipo_chave_uk
    unique (empresa_id, tipo_registro, chave_externa)
);

create or replace function private.wvetro_historico_suprimentos_validar_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.importado_por_id is not null and not exists (
    select 1 from public.usuarios u
    where u.id = new.importado_por_id and u.empresa_id = new.empresa_id
  ) then
    raise exception 'Usuário importador não pertence à empresa do histórico de suprimentos W.Vetro.';
  end if;
  return new;
end;
$$;

revoke all on function private.wvetro_historico_suprimentos_validar_tenant() from public;

drop trigger if exists trg_wvetro_historico_suprimentos_validar_tenant
  on public.wvetro_historico_suprimentos;
create trigger trg_wvetro_historico_suprimentos_validar_tenant
before insert or update of empresa_id, importado_por_id
on public.wvetro_historico_suprimentos
for each row execute function private.wvetro_historico_suprimentos_validar_tenant();

create index if not exists wvetro_historico_suprimentos_tipo_data_idx
  on public.wvetro_historico_suprimentos (empresa_id, tipo_registro, data_referencia desc nulls last);
create index if not exists wvetro_historico_suprimentos_produto_idx
  on public.wvetro_historico_suprimentos (empresa_id, produto_codigo)
  where produto_codigo is not null;
create index if not exists wvetro_historico_suprimentos_fornecedor_idx
  on public.wvetro_historico_suprimentos (empresa_id, fornecedor_id_wvetro)
  where fornecedor_id_wvetro is not null;

alter table public.wvetro_historico_suprimentos enable row level security;

drop policy if exists wvetro_historico_suprimentos_select_empresa on public.wvetro_historico_suprimentos;
create policy wvetro_historico_suprimentos_select_empresa on public.wvetro_historico_suprimentos
for select to authenticated using (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_historico_suprimentos_insert_empresa on public.wvetro_historico_suprimentos;
create policy wvetro_historico_suprimentos_insert_empresa on public.wvetro_historico_suprimentos
for insert to authenticated with check (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_historico_suprimentos_update_empresa on public.wvetro_historico_suprimentos;
create policy wvetro_historico_suprimentos_update_empresa on public.wvetro_historico_suprimentos
for update to authenticated
using (empresa_id = (select private.current_empresa_id()))
with check (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_historico_suprimentos_delete_empresa on public.wvetro_historico_suprimentos;
create policy wvetro_historico_suprimentos_delete_empresa on public.wvetro_historico_suprimentos
for delete to authenticated using (empresa_id = (select private.current_empresa_id()));

revoke all on public.wvetro_historico_suprimentos from anon;
grant select, insert, update, delete on public.wvetro_historico_suprimentos to authenticated;
grant all on public.wvetro_historico_suprimentos to service_role;

comment on table public.wvetro_historico_suprimentos is
  'Histórico legado W.Vetro de movimentos de estoque e notas de entrada; somente consulta.';
