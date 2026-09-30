-- WhatsApp multicanal: numero principal da empresa + numeros vinculados a usuarios.

create table if not exists public.atendimento_whatsapp_canais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  numero_declarado text not null,
  numero_conectado text,
  tipo_conta text not null default 'nao_informado',
  principal boolean not null default false,
  usuario_id uuid references public.usuarios(id) on delete set null,
  usuario_nome text,
  ativo boolean not null default true,
  session_slug text not null default gen_random_uuid()::text,
  gateway_status text not null default 'offline',
  gateway_qr_data_url text,
  gateway_qr_updated_at timestamptz,
  gateway_connected_jid text,
  gateway_last_seen_at timestamptz,
  gateway_device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='atendimento_whatsapp_canais_tipo_check'
      and conrelid='public.atendimento_whatsapp_canais'::regclass
  ) then
    alter table public.atendimento_whatsapp_canais
      add constraint atendimento_whatsapp_canais_tipo_check
      check (tipo_conta in ('business','pessoal','nao_informado'));
  end if;
end $$;

create unique index if not exists atendimento_whatsapp_canais_empresa_numero_uidx
  on public.atendimento_whatsapp_canais (empresa_id, numero_declarado)
  where ativo = true;

create unique index if not exists atendimento_whatsapp_canais_principal_uidx
  on public.atendimento_whatsapp_canais (empresa_id)
  where principal = true and ativo = true;

create index if not exists atendimento_whatsapp_canais_usuario_idx
  on public.atendimento_whatsapp_canais (empresa_id, usuario_id, ativo);

insert into public.atendimento_whatsapp_canais (
  empresa_id,nome,numero_declarado,tipo_conta,principal,ativo,
  gateway_status,gateway_qr_data_url,gateway_qr_updated_at,
  gateway_connected_jid,gateway_last_seen_at,gateway_device_name
)
select
  c.empresa_id,
  'WhatsApp Principal',
  c.numero_principal,
  'business',
  true,
  c.ativo,
  case
    when regexp_replace(coalesce(c.gateway_connected_jid,''),'[^0-9]','','g')
         like c.numero_principal || '%' then c.gateway_status
    else 'offline'
  end,
  case
    when regexp_replace(coalesce(c.gateway_connected_jid,''),'[^0-9]','','g')
         like c.numero_principal || '%' then c.gateway_qr_data_url
    else null
  end,
  case
    when regexp_replace(coalesce(c.gateway_connected_jid,''),'[^0-9]','','g')
         like c.numero_principal || '%' then c.gateway_qr_updated_at
    else null
  end,
  case
    when regexp_replace(coalesce(c.gateway_connected_jid,''),'[^0-9]','','g')
         like c.numero_principal || '%' then c.gateway_connected_jid
    else null
  end,
  case
    when regexp_replace(coalesce(c.gateway_connected_jid,''),'[^0-9]','','g')
         like c.numero_principal || '%' then c.gateway_last_seen_at
    else null
  end,
  c.gateway_device_name
from public.atendimento_configuracoes c
on conflict do nothing;

insert into public.atendimento_whatsapp_canais (
  empresa_id,nome,numero_declarado,numero_conectado,tipo_conta,principal,ativo,
  gateway_status,gateway_connected_jid,gateway_last_seen_at,gateway_device_name
)
select
  c.empresa_id,
  'WhatsApp conectado',
  substring(regexp_replace(c.gateway_connected_jid,'[^0-9]','','g') from 1 for 13),
  substring(regexp_replace(c.gateway_connected_jid,'[^0-9]','','g') from 1 for 13),
  'nao_informado',
  false,
  true,
  c.gateway_status,
  c.gateway_connected_jid,
  c.gateway_last_seen_at,
  c.gateway_device_name
from public.atendimento_configuracoes c
where c.gateway_connected_jid is not null
  and substring(regexp_replace(c.gateway_connected_jid,'[^0-9]','','g') from 1 for 13) <> c.numero_principal
on conflict do nothing;

alter table public.atendimento_conversas
  add column if not exists whatsapp_canal_id uuid references public.atendimento_whatsapp_canais(id) on delete restrict,
  add column if not exists whatsapp_numero text;

alter table public.atendimento_fila_saida
  add column if not exists whatsapp_canal_id uuid references public.atendimento_whatsapp_canais(id) on delete restrict;

update public.atendimento_conversas c
set whatsapp_canal_id = w.id,
    whatsapp_numero = w.numero_declarado
from public.atendimento_whatsapp_canais w
where c.whatsapp_canal_id is null
  and w.empresa_id = c.empresa_id
  and w.principal = true
  and w.ativo = true;

update public.atendimento_fila_saida f
set whatsapp_canal_id = c.whatsapp_canal_id
from public.atendimento_conversas c
where c.id = f.conversa_id
  and f.whatsapp_canal_id is null;

create index if not exists atendimento_conversas_canal_idx
  on public.atendimento_conversas (empresa_id, whatsapp_canal_id, ultima_mensagem_em desc);

create index if not exists atendimento_fila_saida_canal_status_idx
  on public.atendimento_fila_saida (empresa_id, whatsapp_canal_id, status, created_at);

alter table public.atendimento_whatsapp_canais enable row level security;
revoke all on public.atendimento_whatsapp_canais from authenticated;
grant select on public.atendimento_whatsapp_canais to authenticated;

drop policy if exists atendimento_whatsapp_canais_select_v1 on public.atendimento_whatsapp_canais;
create policy atendimento_whatsapp_canais_select_v1
on public.atendimento_whatsapp_canais for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (
    (select private.is_master_atlas())
    or usuario_id = (select auth.uid())
    or principal = true
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='atendimento_whatsapp_canais'
  ) then
    alter publication supabase_realtime add table public.atendimento_whatsapp_canais;
  end if;
end $$;

comment on table public.atendimento_whatsapp_canais is
  'Canais WhatsApp por empresa. Um principal central e canais adicionais vinculaveis a usuarios.';