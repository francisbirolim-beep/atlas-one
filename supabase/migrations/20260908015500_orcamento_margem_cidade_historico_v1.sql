-- Atlas One — margem sugerida por cidade e histórico comercial imutável.
-- Não define margem para nenhuma cidade: apenas cria a estrutura configurável/versionada.

create table if not exists public.orcamento_margens_cidade (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default private.current_empresa_id(),
  cidade text not null,
  cidade_chave text not null,
  uf text not null,
  margem_pct numeric not null check (margem_pct >= 0 and margem_pct < 100),
  versao integer not null check (versao > 0),
  vigente boolean not null default true,
  vigencia_inicio timestamptz not null default now(),
  vigencia_fim timestamptz,
  motivo text not null,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orcamento_margens_cidade_uf_check check (uf = upper(uf) and char_length(uf) = 2),
  constraint orcamento_margens_cidade_chave_check check (cidade_chave = lower(btrim(cidade_chave)) and cidade_chave <> ''),
  constraint orcamento_margens_cidade_vigencia_check check (vigencia_fim is null or vigencia_fim >= vigencia_inicio),
  unique (empresa_id, cidade_chave, uf, versao)
);

create unique index if not exists orcamento_margens_cidade_vigente_uq
  on public.orcamento_margens_cidade(empresa_id, cidade_chave, uf)
  where vigente = true;
create index if not exists orcamento_margens_cidade_busca_idx
  on public.orcamento_margens_cidade(empresa_id, uf, cidade_chave, vigente, versao desc);

comment on table public.orcamento_margens_cidade is
  'Tabela versionada de margem comercial sugerida por cidade. Cada alteração deve criar nova versão; não contém margem padrão inventada.';
comment on column public.orcamento_margens_cidade.cidade_chave is
  'Chave normalizada pela aplicação com trim/lower para busca determinística dentro da empresa.';
comment on column public.orcamento_margens_cidade.margem_pct is
  'Margem apenas sugerida ao iniciar o orçamento; o orçamento e cada tipologia podem sobrescrever conforme política comercial auditada.';

create table if not exists public.orcamento_precificacao_historico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default private.current_empresa_id(),
  orcamento_id uuid references public.orcamentos(id) on delete set null,
  item_ref text,
  tipo_alteracao text not null check (tipo_alteracao in ('margem','desconto','custo','sobra')),
  campo text not null,
  valor_anterior jsonb,
  valor_novo jsonb,
  motivo text not null,
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz not null default now()
);

create index if not exists orcamento_precificacao_historico_orc_idx
  on public.orcamento_precificacao_historico(empresa_id, orcamento_id, item_ref, created_at desc);

comment on table public.orcamento_precificacao_historico is
  'Histórico append-only de alterações de margem, desconto, custo e sobra, com antes/depois, usuário, data e motivo.';

create or replace function private.orcamento_margem_cidade_versao_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.empresa_id is distinct from old.empresa_id
     or new.cidade is distinct from old.cidade
     or new.cidade_chave is distinct from old.cidade_chave
     or new.uf is distinct from old.uf
     or new.margem_pct is distinct from old.margem_pct
     or new.versao is distinct from old.versao
     or new.vigencia_inicio is distinct from old.vigencia_inicio
     or new.motivo is distinct from old.motivo
     or new.criado_por_id is distinct from old.criado_por_id
     or new.criado_por_nome is distinct from old.criado_por_nome
     or new.created_at is distinct from old.created_at then
    raise exception 'Margem por cidade é versionada: crie nova versão em vez de alterar a versão existente';
  end if;

  if old.vigente = false and new.vigente = true then
    raise exception 'Versão encerrada de margem por cidade não pode ser reativada';
  end if;

  if old.vigente = true and new.vigente = false and new.vigencia_fim is null then
    new.vigencia_fim := now();
  end if;

  if old.vigente = false and new.vigencia_fim is distinct from old.vigencia_fim then
    raise exception 'Vigência encerrada não pode ser reescrita';
  end if;

  return new;
end;
$$;

create or replace function private.orcamento_precificacao_historico_empresa_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  if new.orcamento_id is not null then
    select o.empresa_id into v_empresa
    from public.orcamentos o
    where o.id = new.orcamento_id;

    if v_empresa is null then
      raise exception 'Orçamento do histórico não encontrado ou sem empresa';
    end if;

    if new.empresa_id is null then
      new.empresa_id := v_empresa;
    elsif new.empresa_id is distinct from v_empresa then
      raise exception 'Histórico de precificação pertence a empresa diferente do orçamento';
    end if;
  elsif new.empresa_id is null then
    new.empresa_id := private.current_empresa_id();
  end if;

  if new.empresa_id is null then
    raise exception 'Histórico de precificação sem empresa';
  end if;

  return new;
end;
$$;

alter table public.orcamento_margens_cidade enable row level security;
alter table public.orcamento_precificacao_historico enable row level security;

drop policy if exists tenant_orcamento_margens_cidade_select on public.orcamento_margens_cidade;
create policy tenant_orcamento_margens_cidade_select
on public.orcamento_margens_cidade for select to authenticated
using (empresa_id = (select private.current_empresa_id()));

drop policy if exists tenant_orcamento_margens_cidade_insert on public.orcamento_margens_cidade;
create policy tenant_orcamento_margens_cidade_insert
on public.orcamento_margens_cidade for insert to authenticated
with check (empresa_id = (select private.current_empresa_id()));

drop policy if exists tenant_orcamento_margens_cidade_update on public.orcamento_margens_cidade;
create policy tenant_orcamento_margens_cidade_update
on public.orcamento_margens_cidade for update to authenticated
using (empresa_id = (select private.current_empresa_id()))
with check (empresa_id = (select private.current_empresa_id()));

drop policy if exists tenant_orcamento_precificacao_historico_select on public.orcamento_precificacao_historico;
create policy tenant_orcamento_precificacao_historico_select
on public.orcamento_precificacao_historico for select to authenticated
using (empresa_id = (select private.current_empresa_id()));

drop policy if exists tenant_orcamento_precificacao_historico_insert on public.orcamento_precificacao_historico;
create policy tenant_orcamento_precificacao_historico_insert
on public.orcamento_precificacao_historico for insert to authenticated
with check (empresa_id = (select private.current_empresa_id()));

drop trigger if exists trg_orcamento_margem_cidade_versao_guard on public.orcamento_margens_cidade;
create trigger trg_orcamento_margem_cidade_versao_guard
before update on public.orcamento_margens_cidade
for each row execute function private.orcamento_margem_cidade_versao_guard();

drop trigger if exists trg_orcamento_precificacao_historico_empresa_guard on public.orcamento_precificacao_historico;
create trigger trg_orcamento_precificacao_historico_empresa_guard
before insert on public.orcamento_precificacao_historico
for each row execute function private.orcamento_precificacao_historico_empresa_guard();

drop trigger if exists orcamento_margens_cidade_updated_at on public.orcamento_margens_cidade;
create trigger orcamento_margens_cidade_updated_at
before update on public.orcamento_margens_cidade
for each row execute function public.update_updated_at();

grant select, insert, update on public.orcamento_margens_cidade to authenticated;
revoke delete on public.orcamento_margens_cidade from authenticated;
grant select, insert on public.orcamento_precificacao_historico to authenticated;
revoke update, delete on public.orcamento_precificacao_historico from authenticated;

revoke all on function private.orcamento_margem_cidade_versao_guard() from public, anon, authenticated;
revoke all on function private.orcamento_precificacao_historico_empresa_guard() from public, anon, authenticated;
