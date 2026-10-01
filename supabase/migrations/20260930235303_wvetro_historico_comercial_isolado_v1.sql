-- Atlas One — histórico comercial W.Vetro isolado do workflow operacional
-- Esta tabela NÃO substitui public.orcamentos/public.vendas_obras.
-- Objetivo: armazenar histórico legado sem disparar Financeiro, Kanban, Engenharia ou automações de venda.

create table if not exists public.wvetro_historico_comercial (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid null references public.clientes(id) on delete set null,

  tipo_registro text not null check (
    tipo_registro in (
      'orcamento_historico',
      'venda_historica_orcamento',
      'venda_historica_pedido'
    )
  ),
  chave_externa text not null,
  numero_wvetro text null,
  situacao_wvetro text null,

  data_emissao date null,
  data_venda date null,
  valor_total numeric(14,2) null,

  cliente_nome_origem text null,
  cliente_documento_origem text null,
  cliente_codigo_origem text null,

  metodo_identidade text null,
  status_vinculo text not null default 'pendente' check (
    status_vinculo in ('seguro','pendente','revisao','sem_cliente')
  ),

  itens jsonb not null default '[]'::jsonb,
  payload_origem jsonb not null,
  dados_origem jsonb not null default '{}'::jsonb,

  somente_historico boolean not null default true check (somente_historico = true),

  importado_por_id uuid null references public.usuarios(id) on delete set null,
  importado_por_nome text null,
  importado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wvetro_historico_comercial_empresa_tipo_chave_uk
    unique (empresa_id, tipo_registro, chave_externa)
);



create or replace function private.wvetro_historico_validar_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cliente_id is not null and not exists (
    select 1
    from public.clientes c
    where c.id = new.cliente_id
      and c.empresa_id = new.empresa_id
  ) then
    raise exception 'Cliente não pertence à empresa do histórico W.Vetro.';
  end if;

  if new.importado_por_id is not null and not exists (
    select 1
    from public.usuarios u
    where u.id = new.importado_por_id
      and u.empresa_id = new.empresa_id
  ) then
    raise exception 'Usuário importador não pertence à empresa do histórico W.Vetro.';
  end if;

  return new;
end;
$$;

revoke all on function private.wvetro_historico_validar_tenant() from public;

drop trigger if exists trg_wvetro_historico_validar_tenant
  on public.wvetro_historico_comercial;

create trigger trg_wvetro_historico_validar_tenant
before insert or update of empresa_id, cliente_id, importado_por_id
on public.wvetro_historico_comercial
for each row
execute function private.wvetro_historico_validar_tenant();

create index if not exists wvetro_historico_comercial_cliente_idx
  on public.wvetro_historico_comercial (empresa_id, cliente_id, data_venda desc nulls last, data_emissao desc nulls last);

create index if not exists wvetro_historico_comercial_numero_idx
  on public.wvetro_historico_comercial (empresa_id, numero_wvetro);

create index if not exists wvetro_historico_comercial_tipo_idx
  on public.wvetro_historico_comercial (empresa_id, tipo_registro, status_vinculo);

alter table public.wvetro_historico_comercial enable row level security;

drop policy if exists wvetro_historico_comercial_select_empresa on public.wvetro_historico_comercial;
create policy wvetro_historico_comercial_select_empresa
  on public.wvetro_historico_comercial
  for select
  to authenticated
  using (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_historico_comercial_insert_empresa on public.wvetro_historico_comercial;
create policy wvetro_historico_comercial_insert_empresa
  on public.wvetro_historico_comercial
  for insert
  to authenticated
  with check (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_historico_comercial_update_empresa on public.wvetro_historico_comercial;
create policy wvetro_historico_comercial_update_empresa
  on public.wvetro_historico_comercial
  for update
  to authenticated
  using (empresa_id = (select private.current_empresa_id()))
  with check (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_historico_comercial_delete_empresa on public.wvetro_historico_comercial;
create policy wvetro_historico_comercial_delete_empresa
  on public.wvetro_historico_comercial
  for delete
  to authenticated
  using (empresa_id = (select private.current_empresa_id()));

revoke all on public.wvetro_historico_comercial from anon;
grant select, insert, update, delete on public.wvetro_historico_comercial to authenticated;
grant all on public.wvetro_historico_comercial to service_role;

comment on table public.wvetro_historico_comercial is
  'Histórico comercial legado do W.Vetro. Isolado do workflow operacional do Atlas; não dispara venda, Financeiro, Kanban ou Engenharia.';

comment on column public.wvetro_historico_comercial.somente_historico is
  'Gate estrutural: esta tabela existe apenas para consulta histórica e deve permanecer TRUE.';
