-- WhatsApp Business no Atlas One: multitenancy, roteamento, auditoria e Realtime.
-- Evolui a base atendimento_whatsapp_base aplicada em 2026-09-25.

alter table public.atendimento_conversas
  add column if not exists empresa_id uuid references public.empresas(id) on delete restrict,
  add column if not exists contato_nome text,
  add column if not exists ultimo_preview text,
  add column if not exists nao_lidas integer not null default 0,
  add column if not exists ultima_entrada_em timestamptz,
  add column if not exists ultima_saida_em timestamptz;

alter table public.atendimento_sessoes
  add column if not exists empresa_id uuid references public.empresas(id) on delete restrict;

alter table public.atendimento_mensagens
  add column if not exists empresa_id uuid references public.empresas(id) on delete restrict,
  add column if not exists media_id text,
  add column if not exists mime_type text,
  add column if not exists provider_timestamp timestamptz,
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.atendimento_eventos
  add column if not exists empresa_id uuid references public.empresas(id) on delete restrict;

update public.atendimento_conversas c
set empresa_id = coalesce(
  c.empresa_id,
  (select u.empresa_id from public.usuarios u where u.id = c.responsavel_id),
  (select cl.empresa_id from public.clientes cl where cl.id = c.cliente_id)
)
where c.empresa_id is null;

do $$
declare
  v_empresa uuid;
begin
  if (select count(*) from public.empresas) = 1 then
    select id into v_empresa from public.empresas limit 1;
    update public.atendimento_conversas
       set empresa_id = v_empresa
     where empresa_id is null;
  end if;
end $$;

update public.atendimento_sessoes s
set empresa_id = c.empresa_id
from public.atendimento_conversas c
where c.id = s.conversa_id and s.empresa_id is null;

update public.atendimento_mensagens m
set empresa_id = c.empresa_id
from public.atendimento_conversas c
where c.id = m.conversa_id and m.empresa_id is null;

update public.atendimento_eventos e
set empresa_id = c.empresa_id
from public.atendimento_conversas c
where c.id = e.conversa_id and e.empresa_id is null;

do $$
begin
  if exists (select 1 from public.atendimento_conversas where empresa_id is null)
     or exists (select 1 from public.atendimento_sessoes where empresa_id is null)
     or exists (select 1 from public.atendimento_mensagens where empresa_id is null)
     or exists (select 1 from public.atendimento_eventos where empresa_id is null) then
    raise exception 'Nao foi possivel determinar empresa_id para todos os registros de atendimento.';
  end if;
end $$;

alter table public.atendimento_conversas alter column empresa_id set not null;
alter table public.atendimento_sessoes alter column empresa_id set not null;
alter table public.atendimento_mensagens alter column empresa_id set not null;
alter table public.atendimento_eventos alter column empresa_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='atendimento_conversas_nao_lidas_check'
      and conrelid='public.atendimento_conversas'::regclass
  ) then
    alter table public.atendimento_conversas
      add constraint atendimento_conversas_nao_lidas_check check (nao_lidas >= 0);
  end if;
end $$;

create index if not exists atendimento_conversas_empresa_canal_telefone_idx
  on public.atendimento_conversas (empresa_id, canal, telefone);

create index if not exists atendimento_conversas_empresa_responsavel_status_idx
  on public.atendimento_conversas (empresa_id, responsavel_id, status, ultima_mensagem_em desc);

create index if not exists atendimento_mensagens_empresa_conversa_created_idx
  on public.atendimento_mensagens (empresa_id, conversa_id, created_at);

create table if not exists public.atendimento_configuracoes (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  numero_principal text not null,
  phone_number_id text unique,
  setor_padrao text,
  usuario_padrao_id uuid references public.usuarios(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atendimento_regras_roteamento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  prioridade integer not null default 100,
  palavras_chave text[] not null default '{}'::text[],
  setor text,
  usuario_id uuid references public.usuarios(id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists atendimento_regras_empresa_prioridade_idx
  on public.atendimento_regras_roteamento (empresa_id, ativo, prioridade);

alter table public.atendimento_configuracoes enable row level security;
alter table public.atendimento_regras_roteamento enable row level security;
alter table public.atendimento_conversas enable row level security;
alter table public.atendimento_sessoes enable row level security;
alter table public.atendimento_mensagens enable row level security;
alter table public.atendimento_eventos enable row level security;

drop policy if exists atendimento_conversas_auth_insert on public.atendimento_conversas;
drop policy if exists atendimento_conversas_auth_select on public.atendimento_conversas;
drop policy if exists atendimento_conversas_auth_update on public.atendimento_conversas;
drop policy if exists atendimento_sessoes_auth_insert on public.atendimento_sessoes;
drop policy if exists atendimento_sessoes_auth_select on public.atendimento_sessoes;
drop policy if exists atendimento_sessoes_auth_update on public.atendimento_sessoes;
drop policy if exists atendimento_mensagens_auth_insert on public.atendimento_mensagens;
drop policy if exists atendimento_mensagens_auth_select on public.atendimento_mensagens;
drop policy if exists atendimento_eventos_auth_insert on public.atendimento_eventos;
drop policy if exists atendimento_eventos_auth_select on public.atendimento_eventos;

drop policy if exists atendimento_conversas_select_v2 on public.atendimento_conversas;
create policy atendimento_conversas_select_v2
on public.atendimento_conversas for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (
    (select private.is_master_atlas())
    or responsavel_id = (select auth.uid())
    or responsavel_id is null
  )
);

drop policy if exists atendimento_sessoes_select_v2 on public.atendimento_sessoes;
create policy atendimento_sessoes_select_v2
on public.atendimento_sessoes for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and exists (
    select 1
    from public.atendimento_conversas c
    where c.id = conversa_id
      and c.empresa_id = (select private.current_empresa_id())
      and (
        (select private.is_master_atlas())
        or c.responsavel_id = (select auth.uid())
        or c.responsavel_id is null
      )
  )
);

drop policy if exists atendimento_mensagens_select_v2 on public.atendimento_mensagens;
create policy atendimento_mensagens_select_v2
on public.atendimento_mensagens for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and exists (
    select 1
    from public.atendimento_conversas c
    where c.id = conversa_id
      and c.empresa_id = (select private.current_empresa_id())
      and (
        (select private.is_master_atlas())
        or c.responsavel_id = (select auth.uid())
        or c.responsavel_id is null
      )
  )
);

drop policy if exists atendimento_eventos_select_v2 on public.atendimento_eventos;
create policy atendimento_eventos_select_v2
on public.atendimento_eventos for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and exists (
    select 1
    from public.atendimento_conversas c
    where c.id = conversa_id
      and c.empresa_id = (select private.current_empresa_id())
      and (
        (select private.is_master_atlas())
        or c.responsavel_id = (select auth.uid())
        or c.responsavel_id is null
      )
  )
);

drop policy if exists atendimento_configuracoes_master_select_v2 on public.atendimento_configuracoes;
create policy atendimento_configuracoes_master_select_v2
on public.atendimento_configuracoes for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (select private.is_master_atlas())
);

drop policy if exists atendimento_regras_master_select_v2 on public.atendimento_regras_roteamento;
create policy atendimento_regras_master_select_v2
on public.atendimento_regras_roteamento for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (select private.is_master_atlas())
);

revoke all on public.atendimento_conversas from authenticated;
revoke all on public.atendimento_sessoes from authenticated;
revoke all on public.atendimento_mensagens from authenticated;
revoke all on public.atendimento_eventos from authenticated;
revoke all on public.atendimento_configuracoes from authenticated;
revoke all on public.atendimento_regras_roteamento from authenticated;

grant select on public.atendimento_conversas to authenticated;
grant select on public.atendimento_sessoes to authenticated;
grant select on public.atendimento_mensagens to authenticated;
grant select on public.atendimento_eventos to authenticated;
grant select on public.atendimento_configuracoes to authenticated;
grant select on public.atendimento_regras_roteamento to authenticated;

create or replace function private.atendimento_append_only_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Registros de mensagens e eventos de atendimento sao imutaveis.';
end;
$$;

drop trigger if exists atendimento_mensagens_append_only on public.atendimento_mensagens;
create trigger atendimento_mensagens_append_only
before update or delete on public.atendimento_mensagens
for each row execute function private.atendimento_append_only_guard();

drop trigger if exists atendimento_eventos_append_only on public.atendimento_eventos;
create trigger atendimento_eventos_append_only
before update or delete on public.atendimento_eventos
for each row execute function private.atendimento_append_only_guard();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='atendimento_conversas'
  ) then
    alter publication supabase_realtime add table public.atendimento_conversas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='atendimento_mensagens'
  ) then
    alter publication supabase_realtime add table public.atendimento_mensagens;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='atendimento_eventos'
  ) then
    alter publication supabase_realtime add table public.atendimento_eventos;
  end if;
end $$;

comment on table public.atendimento_configuracoes is
  'Configuracao por empresa do canal WhatsApp Business usado pelo Atlas One.';
comment on table public.atendimento_regras_roteamento is
  'Regras ordenadas de roteamento de conversas WhatsApp para setor/usuario.';
comment on table public.atendimento_mensagens is
  'Historico append-only de mensagens recebidas e enviadas pelo atendimento Atlas.';
comment on table public.atendimento_eventos is
  'Trilha append-only de auditoria do atendimento WhatsApp.';