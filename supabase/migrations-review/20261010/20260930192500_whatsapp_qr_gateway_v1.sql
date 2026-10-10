alter table public.atendimento_configuracoes
  add column if not exists modo_integracao text not null default 'qr',
  add column if not exists gateway_token_hash text,
  add column if not exists gateway_status text not null default 'offline',
  add column if not exists gateway_qr_data_url text,
  add column if not exists gateway_qr_updated_at timestamptz,
  add column if not exists gateway_connected_jid text,
  add column if not exists gateway_last_seen_at timestamptz,
  add column if not exists gateway_device_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='atendimento_configuracoes_modo_integracao_check'
      and conrelid='public.atendimento_configuracoes'::regclass
  ) then
    alter table public.atendimento_configuracoes
      add constraint atendimento_configuracoes_modo_integracao_check
      check (modo_integracao in ('qr','cloud_api'));
  end if;
end $$;

create table if not exists public.atendimento_fila_saida (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  conversa_id uuid not null references public.atendimento_conversas(id) on delete cascade,
  mensagem_id uuid references public.atendimento_mensagens(id) on delete set null,
  telefone text not null,
  tipo text not null default 'text',
  texto text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pendente',
  tentativas integer not null default 0,
  erro text,
  processando_em timestamptz,
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='atendimento_fila_saida_status_check'
      and conrelid='public.atendimento_fila_saida'::regclass
  ) then
    alter table public.atendimento_fila_saida
      add constraint atendimento_fila_saida_status_check
      check (status in ('pendente','processando','enviado','erro'));
  end if;
end $$;

create index if not exists atendimento_fila_saida_pendentes_idx
  on public.atendimento_fila_saida (empresa_id, status, created_at);
create index if not exists atendimento_fila_saida_conversa_idx
  on public.atendimento_fila_saida (conversa_id, created_at);
create index if not exists atendimento_fila_saida_mensagem_idx
  on public.atendimento_fila_saida (mensagem_id);

alter table public.atendimento_fila_saida enable row level security;
revoke all on public.atendimento_fila_saida from authenticated;
grant select on public.atendimento_fila_saida to authenticated;

drop policy if exists atendimento_fila_saida_master_select_v1 on public.atendimento_fila_saida;
create policy atendimento_fila_saida_master_select_v1
on public.atendimento_fila_saida for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (select private.is_master_atlas())
);

update public.atendimento_configuracoes
set modo_integracao='qr',
    gateway_status=case when gateway_status is null then 'offline' else gateway_status end,
    updated_at=now();

comment on table public.atendimento_fila_saida is
  'Fila de mensagens de saida consumida pelo gateway persistente do WhatsApp via QR.';