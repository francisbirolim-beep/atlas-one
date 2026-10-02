-- Central de Notificações + Web Push por dispositivo.
alter table public.notificacao_preferencias
  add column if not exists push_ativo boolean not null default true,
  add column if not exists nao_perturbe_ativo boolean not null default false,
  add column if not exists nao_perturbe_inicio time not null default '22:00',
  add column if not exists nao_perturbe_fim time not null default '07:00',
  add column if not exists timezone text not null default 'America/Sao_Paulo';

alter table public.notificacoes
  add column if not exists push_status text,
  add column if not exists push_tentativas integer not null default 0,
  add column if not exists push_ultimo_em timestamptz,
  add column if not exists push_enviado_em timestamptz,
  add column if not exists push_erro text;

update public.notificacoes
set push_status = 'ignorado'
where push_status is null;

alter table public.notificacoes
  alter column push_status set default 'pendente',
  alter column push_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'notificacoes_push_status_check'
      and conrelid = 'public.notificacoes'::regclass
  ) then
    alter table public.notificacoes
      add constraint notificacoes_push_status_check
      check (push_status in ('pendente','processando','enviado','ignorado','erro'));
  end if;
end $$;

create index if not exists notificacoes_push_pendentes_idx
  on public.notificacoes(push_status, created_at)
  where push_status in ('pendente','processando');

create table if not exists public.notificacao_push_assinaturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  usuario_id uuid not null references public.usuarios(id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  dispositivo_nome text,
  user_agent text,
  ativo boolean not null default true,
  erro_count integer not null default 0,
  ultimo_erro text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notificacao_push_assinaturas_usuario_idx
  on public.notificacao_push_assinaturas(usuario_id, ativo, updated_at desc);
create index if not exists notificacao_push_assinaturas_empresa_idx
  on public.notificacao_push_assinaturas(empresa_id, ativo);

alter table public.notificacao_push_assinaturas enable row level security;
revoke all on public.notificacao_push_assinaturas from anon, authenticated;

drop policy if exists notificacao_push_assinaturas_backend_only
  on public.notificacao_push_assinaturas;
create policy notificacao_push_assinaturas_backend_only
  on public.notificacao_push_assinaturas
  for select to authenticated
  using (false);
