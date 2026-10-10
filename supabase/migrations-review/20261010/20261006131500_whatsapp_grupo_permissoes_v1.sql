-- Permissões granulares por grupo do WhatsApp.
-- Quando existe uma linha para usuario+grupo, ela substitui o nível herdado do canal.
create table if not exists public.atendimento_whatsapp_grupo_permissoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  grupo_id uuid not null references public.atendimento_whatsapp_grupos(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  nivel text not null default 'acompanhar'
    check (nivel in ('sem_acesso','acompanhar','atender','gerenciar')),
  responsavel_principal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grupo_id, usuario_id)
);

create index if not exists atendimento_whatsapp_grupo_permissoes_empresa_usuario_idx
  on public.atendimento_whatsapp_grupo_permissoes (empresa_id, usuario_id, grupo_id);

create unique index if not exists atendimento_whatsapp_grupo_responsavel_unico_idx
  on public.atendimento_whatsapp_grupo_permissoes (grupo_id)
  where responsavel_principal = true;

alter table public.atendimento_whatsapp_grupo_permissoes enable row level security;
revoke all on public.atendimento_whatsapp_grupo_permissoes from authenticated;
grant select on public.atendimento_whatsapp_grupo_permissoes to authenticated;

drop policy if exists atendimento_whatsapp_grupo_permissoes_select_v1
  on public.atendimento_whatsapp_grupo_permissoes;
create policy atendimento_whatsapp_grupo_permissoes_select_v1
on public.atendimento_whatsapp_grupo_permissoes for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (
    (select private.is_master_atlas())
    or usuario_id = (select auth.uid())
  )
);

comment on table public.atendimento_whatsapp_grupo_permissoes is
  'Nível de acesso por usuário em cada grupo WhatsApp: sem acesso, acompanhar, atender ou gerenciar; opcionalmente responsável principal.';
