-- Atlas One — validação humana de candidatos W.Vetro por Cliente 360
-- Permite aprovar/rejeitar um orçamento candidato para um cliente específico
-- sem apagar o histórico W.Vetro que pode pertencer a outro homônimo.

create table if not exists public.wvetro_cliente_orcamento_validacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  historico_id uuid not null references public.wvetro_historico_comercial(id) on delete cascade,
  numero_wvetro text not null,
  cliente_nome_origem text null,
  status text not null check (status in ('aprovado','rejeitado')),
  validado_por_id uuid null references public.usuarios(id) on delete set null,
  validado_por_nome text null,
  validado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wvetro_cliente_orcamento_validacoes_uk
    unique (empresa_id, cliente_id, historico_id)
);

create or replace function private.wvetro_validacao_cliente_validar_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.clientes c
    where c.id = new.cliente_id and c.empresa_id = new.empresa_id
  ) then
    raise exception 'Cliente não pertence à empresa da validação W.Vetro.';
  end if;

  if not exists (
    select 1 from public.wvetro_historico_comercial h
    where h.id = new.historico_id and h.empresa_id = new.empresa_id
  ) then
    raise exception 'Histórico W.Vetro não pertence à empresa da validação.';
  end if;

  if new.validado_por_id is not null and not exists (
    select 1 from public.usuarios u
    where u.id = new.validado_por_id and u.empresa_id = new.empresa_id
  ) then
    raise exception 'Usuário não pertence à empresa da validação W.Vetro.';
  end if;

  return new;
end;
$$;

revoke all on function private.wvetro_validacao_cliente_validar_tenant() from public;

drop trigger if exists trg_wvetro_validacao_cliente_validar_tenant
  on public.wvetro_cliente_orcamento_validacoes;

create trigger trg_wvetro_validacao_cliente_validar_tenant
before insert or update of empresa_id,cliente_id,historico_id,validado_por_id
on public.wvetro_cliente_orcamento_validacoes
for each row
execute function private.wvetro_validacao_cliente_validar_tenant();

create index if not exists wvetro_cliente_orcamento_validacoes_cliente_idx
  on public.wvetro_cliente_orcamento_validacoes (empresa_id,cliente_id,status,updated_at desc);

create index if not exists wvetro_cliente_orcamento_validacoes_numero_idx
  on public.wvetro_cliente_orcamento_validacoes (empresa_id,numero_wvetro);

alter table public.wvetro_cliente_orcamento_validacoes enable row level security;

drop policy if exists wvetro_cliente_orcamento_validacoes_select_empresa
  on public.wvetro_cliente_orcamento_validacoes;
create policy wvetro_cliente_orcamento_validacoes_select_empresa
  on public.wvetro_cliente_orcamento_validacoes
  for select to authenticated
  using (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_cliente_orcamento_validacoes_insert_empresa
  on public.wvetro_cliente_orcamento_validacoes;
create policy wvetro_cliente_orcamento_validacoes_insert_empresa
  on public.wvetro_cliente_orcamento_validacoes
  for insert to authenticated
  with check (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_cliente_orcamento_validacoes_update_empresa
  on public.wvetro_cliente_orcamento_validacoes;
create policy wvetro_cliente_orcamento_validacoes_update_empresa
  on public.wvetro_cliente_orcamento_validacoes
  for update to authenticated
  using (empresa_id = (select private.current_empresa_id()))
  with check (empresa_id = (select private.current_empresa_id()));

grant select,insert,update on public.wvetro_cliente_orcamento_validacoes to authenticated;
grant all on public.wvetro_cliente_orcamento_validacoes to service_role;

comment on table public.wvetro_cliente_orcamento_validacoes is
  'Decisão humana por Cliente 360 sobre candidatos de orçamento W.Vetro; rejeição é por cliente e não apaga o histórico de origem.';
