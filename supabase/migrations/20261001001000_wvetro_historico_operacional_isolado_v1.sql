-- Atlas One — histórico operacional W.Vetro isolado
-- Não alimenta Kanban, Produção ativa nem agenda de Instalação.

create table if not exists public.wvetro_historico_operacional (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid null references public.clientes(id) on delete set null,

  tipo_registro text not null check (tipo_registro in ('lote_producao','instalacao')),
  chave_externa text not null,
  numero_wvetro text null,

  data_programacao date null,
  data_inicio timestamptz null,
  data_termino timestamptz null,

  status_vinculo text not null default 'pendente'
    check (status_vinculo in ('seguro','pendente','sem_cliente')),

  equipe_nome text null,
  observacao text null,
  quantidade_prevista numeric null,
  quantidade_realizada numeric null,

  orcamentos_wvetro text[] not null default '{}',
  projetos jsonb not null default '[]'::jsonb,
  payload_origem jsonb not null,
  dados_origem jsonb not null default '{}'::jsonb,

  somente_historico boolean not null default true check (somente_historico = true),

  importado_por_id uuid null references public.usuarios(id) on delete set null,
  importado_por_nome text null,
  importado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wvetro_historico_operacional_empresa_tipo_chave_uk
    unique (empresa_id, tipo_registro, chave_externa)
);

create or replace function private.wvetro_historico_operacional_validar_tenant()
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
    raise exception 'Cliente não pertence à empresa do histórico operacional W.Vetro.';
  end if;

  if new.importado_por_id is not null and not exists (
    select 1 from public.usuarios u
    where u.id = new.importado_por_id and u.empresa_id = new.empresa_id
  ) then
    raise exception 'Usuário importador não pertence à empresa do histórico operacional W.Vetro.';
  end if;

  return new;
end;
$$;

revoke all on function private.wvetro_historico_operacional_validar_tenant() from public;

drop trigger if exists trg_wvetro_historico_operacional_validar_tenant
  on public.wvetro_historico_operacional;
create trigger trg_wvetro_historico_operacional_validar_tenant
before insert or update of empresa_id, cliente_id, importado_por_id
on public.wvetro_historico_operacional
for each row execute function private.wvetro_historico_operacional_validar_tenant();

create index if not exists wvetro_historico_operacional_cliente_idx
  on public.wvetro_historico_operacional (empresa_id, cliente_id, data_programacao desc nulls last);
create index if not exists wvetro_historico_operacional_tipo_idx
  on public.wvetro_historico_operacional (empresa_id, tipo_registro, status_vinculo);

alter table public.wvetro_historico_operacional enable row level security;

drop policy if exists wvetro_historico_operacional_select_empresa on public.wvetro_historico_operacional;
create policy wvetro_historico_operacional_select_empresa on public.wvetro_historico_operacional
for select to authenticated using (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_historico_operacional_insert_empresa on public.wvetro_historico_operacional;
create policy wvetro_historico_operacional_insert_empresa on public.wvetro_historico_operacional
for insert to authenticated with check (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_historico_operacional_update_empresa on public.wvetro_historico_operacional;
create policy wvetro_historico_operacional_update_empresa on public.wvetro_historico_operacional
for update to authenticated
using (empresa_id = (select private.current_empresa_id()))
with check (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_historico_operacional_delete_empresa on public.wvetro_historico_operacional;
create policy wvetro_historico_operacional_delete_empresa on public.wvetro_historico_operacional
for delete to authenticated using (empresa_id = (select private.current_empresa_id()));

revoke all on public.wvetro_historico_operacional from anon;
grant select, insert, update, delete on public.wvetro_historico_operacional to authenticated;
grant all on public.wvetro_historico_operacional to service_role;

comment on table public.wvetro_historico_operacional is
  'Histórico legado W.Vetro de produção e instalação. Somente consulta; isolado dos workflows operacionais do Atlas.';
