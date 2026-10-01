-- Atlas One — histórico financeiro W.Vetro isolado
-- Não compõe saldo, contas a receber/pagar ou fluxo de caixa oficial do Atlas.

create table if not exists public.wvetro_historico_financeiro (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid null references public.clientes(id) on delete set null,

  titulo_id_wvetro text not null,
  fonte_wvetro text not null check (fonte_wvetro in ('titulos','titulos_baixados')),
  tipo_titulo text null,
  origem_titulo text null,
  documento text null,
  pessoa_razao text null,
  orcamento_wvetro text null,

  data_cadastro date null,
  data_emissao date null,
  data_vencimento date null,
  data_baixa date null,

  valor_titulo numeric(14,2) not null default 0,
  valor_recebido numeric(14,2) not null default 0,
  valor_saldo numeric(14,2) not null default 0,
  valor_taxa_cartao numeric(14,2) not null default 0,

  grupo_custo_codigo text null,
  grupo_custo_descricao text null,
  centro_custo_codigo text null,
  centro_custo_descricao text null,
  tipo_lancamento text null,
  usuario_wvetro text null,

  status_vinculo text not null default 'sem_referencia'
    check (status_vinculo in ('seguro','referencia_sem_cliente','sem_referencia')),

  payload_origem jsonb not null,
  dados_origem jsonb not null default '{}'::jsonb,
  somente_historico boolean not null default true check (somente_historico = true),

  importado_por_id uuid null references public.usuarios(id) on delete set null,
  importado_por_nome text null,
  importado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wvetro_historico_financeiro_empresa_titulo_uk
    unique (empresa_id, titulo_id_wvetro)
);

create or replace function private.wvetro_historico_financeiro_validar_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cliente_id is not null and not exists (
    select 1 from public.clientes c
    where c.id = new.cliente_id and c.empresa_id = new.empresa_id
  ) then
    raise exception 'Cliente não pertence à empresa do histórico financeiro W.Vetro.';
  end if;
  if new.importado_por_id is not null and not exists (
    select 1 from public.usuarios u
    where u.id = new.importado_por_id and u.empresa_id = new.empresa_id
  ) then
    raise exception 'Usuário importador não pertence à empresa do histórico financeiro W.Vetro.';
  end if;
  return new;
end;
$$;

revoke all on function private.wvetro_historico_financeiro_validar_tenant() from public;

drop trigger if exists trg_wvetro_historico_financeiro_validar_tenant
  on public.wvetro_historico_financeiro;
create trigger trg_wvetro_historico_financeiro_validar_tenant
before insert or update of empresa_id, cliente_id, importado_por_id
on public.wvetro_historico_financeiro
for each row execute function private.wvetro_historico_financeiro_validar_tenant();

create index if not exists wvetro_historico_financeiro_cliente_idx
  on public.wvetro_historico_financeiro (empresa_id, cliente_id, data_vencimento desc nulls last);
create index if not exists wvetro_historico_financeiro_tipo_idx
  on public.wvetro_historico_financeiro (empresa_id, tipo_titulo, status_vinculo);
create index if not exists wvetro_historico_financeiro_orcamento_idx
  on public.wvetro_historico_financeiro (empresa_id, orcamento_wvetro)
  where orcamento_wvetro is not null;

alter table public.wvetro_historico_financeiro enable row level security;

drop policy if exists wvetro_historico_financeiro_select_empresa on public.wvetro_historico_financeiro;
create policy wvetro_historico_financeiro_select_empresa on public.wvetro_historico_financeiro
for select to authenticated using (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_historico_financeiro_insert_empresa on public.wvetro_historico_financeiro;
create policy wvetro_historico_financeiro_insert_empresa on public.wvetro_historico_financeiro
for insert to authenticated with check (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_historico_financeiro_update_empresa on public.wvetro_historico_financeiro;
create policy wvetro_historico_financeiro_update_empresa on public.wvetro_historico_financeiro
for update to authenticated
using (empresa_id = (select private.current_empresa_id()))
with check (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_historico_financeiro_delete_empresa on public.wvetro_historico_financeiro;
create policy wvetro_historico_financeiro_delete_empresa on public.wvetro_historico_financeiro
for delete to authenticated using (empresa_id = (select private.current_empresa_id()));

revoke all on public.wvetro_historico_financeiro from anon;
grant select, insert, update, delete on public.wvetro_historico_financeiro to authenticated;
grant all on public.wvetro_historico_financeiro to service_role;

comment on table public.wvetro_historico_financeiro is
  'Histórico financeiro legado W.Vetro, somente consulta. Não integra saldos ou lançamentos oficiais do Atlas.';
