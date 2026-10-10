-- Delegacao temporaria da responsabilidade de grupos WhatsApp.
create table if not exists public.atendimento_whatsapp_grupo_delegacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  grupo_id uuid not null references public.atendimento_whatsapp_grupos(id) on delete cascade,
  origem_usuario_id uuid not null references public.usuarios(id) on delete cascade,
  destino_usuario_id uuid not null references public.usuarios(id) on delete cascade,
  inicio_em timestamptz not null default now(),
  fim_em timestamptz not null,
  motivo text,
  ativo boolean not null default true,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  encerrado_em timestamptz,
  check (fim_em > inicio_em),
  check (origem_usuario_id <> destino_usuario_id)
);

create index if not exists atendimento_whatsapp_grupo_delegacoes_ativas_idx
  on public.atendimento_whatsapp_grupo_delegacoes (empresa_id, grupo_id, ativo, inicio_em, fim_em);

alter table public.atendimento_whatsapp_grupo_delegacoes enable row level security;
revoke all on public.atendimento_whatsapp_grupo_delegacoes from authenticated;
grant select on public.atendimento_whatsapp_grupo_delegacoes to authenticated;

drop policy if exists atendimento_whatsapp_grupo_delegacoes_select_v1
  on public.atendimento_whatsapp_grupo_delegacoes;
create policy atendimento_whatsapp_grupo_delegacoes_select_v1
on public.atendimento_whatsapp_grupo_delegacoes for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (
    (select private.is_master_atlas())
    or origem_usuario_id = (select auth.uid())
    or destino_usuario_id = (select auth.uid())
    or exists (
      select 1
      from public.atendimento_whatsapp_grupo_permissoes gp
      where gp.empresa_id = atendimento_whatsapp_grupo_delegacoes.empresa_id
        and gp.grupo_id = atendimento_whatsapp_grupo_delegacoes.grupo_id
        and gp.usuario_id = (select auth.uid())
        and gp.nivel <> 'sem_acesso'
    )
  )
);

comment on table public.atendimento_whatsapp_grupo_delegacoes is
  'Delegacoes temporarias da responsabilidade principal de um grupo WhatsApp para outro usuario.';
