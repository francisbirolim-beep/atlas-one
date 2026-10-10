-- Permissões granulares por canal WhatsApp.
-- Master sempre possui acesso total. Canal principal continua compartilhado na fila.
-- Canais pessoais permanecem privados ao dono, salvo autorização explícita.

create table if not exists public.atendimento_whatsapp_permissoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid not null references public.atendimento_whatsapp_canais(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  pode_visualizar boolean not null default true,
  pode_atender boolean not null default false,
  pode_transferir boolean not null default false,
  pode_supervisionar boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canal_id, usuario_id)
);

create index if not exists atendimento_whatsapp_permissoes_empresa_usuario_idx
  on public.atendimento_whatsapp_permissoes (empresa_id, usuario_id, canal_id);

alter table public.atendimento_whatsapp_permissoes enable row level security;
revoke all on public.atendimento_whatsapp_permissoes from authenticated;
grant select on public.atendimento_whatsapp_permissoes to authenticated;

drop policy if exists atendimento_whatsapp_permissoes_select_v1
  on public.atendimento_whatsapp_permissoes;
create policy atendimento_whatsapp_permissoes_select_v1
on public.atendimento_whatsapp_permissoes for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (
    (select private.is_master_atlas())
    or usuario_id = (select auth.uid())
  )
);

drop policy if exists atendimento_whatsapp_canais_select_v1 on public.atendimento_whatsapp_canais;
drop policy if exists atendimento_whatsapp_canais_select_v2 on public.atendimento_whatsapp_canais;
create policy atendimento_whatsapp_canais_select_v2
on public.atendimento_whatsapp_canais for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (
    (select private.is_master_atlas())
    or principal = true
    or usuario_id = (select auth.uid())
    or exists (
      select 1 from public.atendimento_whatsapp_permissoes p
      where p.canal_id = atendimento_whatsapp_canais.id
        and p.empresa_id = atendimento_whatsapp_canais.empresa_id
        and p.usuario_id = (select auth.uid())
        and p.pode_visualizar = true
    )
  )
);

drop policy if exists atendimento_conversas_select_v2 on public.atendimento_conversas;
drop policy if exists atendimento_conversas_select_v3 on public.atendimento_conversas;
create policy atendimento_conversas_select_v3
on public.atendimento_conversas for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (
    (select private.is_master_atlas())
    or responsavel_id = (select auth.uid())
    or exists (
      select 1 from public.atendimento_whatsapp_canais wc
      where wc.id = atendimento_conversas.whatsapp_canal_id
        and wc.empresa_id = atendimento_conversas.empresa_id
        and (
          wc.usuario_id = (select auth.uid())
          or (
            wc.principal = true
            and responsavel_id is null
          )
          or exists (
            select 1 from public.atendimento_whatsapp_permissoes p
            where p.canal_id = wc.id
              and p.empresa_id = atendimento_conversas.empresa_id
              and p.usuario_id = (select auth.uid())
              and (
                p.pode_supervisionar = true
                or (responsavel_id is null and p.pode_atender = true)
              )
          )
        )
    )
  )
);

drop policy if exists atendimento_sessoes_select_v2 on public.atendimento_sessoes;
drop policy if exists atendimento_sessoes_select_v3 on public.atendimento_sessoes;
create policy atendimento_sessoes_select_v3
on public.atendimento_sessoes for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and exists (
    select 1 from public.atendimento_conversas c
    where c.id = conversa_id
      and c.empresa_id = (select private.current_empresa_id())
      and (
        (select private.is_master_atlas())
        or c.responsavel_id = (select auth.uid())
        or exists (
          select 1 from public.atendimento_whatsapp_canais wc
          where wc.id = c.whatsapp_canal_id
            and wc.empresa_id = c.empresa_id
            and (
              wc.usuario_id = (select auth.uid())
              or (wc.principal = true and c.responsavel_id is null)
              or exists (
                select 1 from public.atendimento_whatsapp_permissoes p
                where p.canal_id = wc.id
                  and p.empresa_id = c.empresa_id
                  and p.usuario_id = (select auth.uid())
                  and (p.pode_supervisionar or (c.responsavel_id is null and p.pode_atender))
              )
            )
        )
      )
  )
);

drop policy if exists atendimento_mensagens_select_v2 on public.atendimento_mensagens;
drop policy if exists atendimento_mensagens_select_v3 on public.atendimento_mensagens;
create policy atendimento_mensagens_select_v3
on public.atendimento_mensagens for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and exists (
    select 1 from public.atendimento_conversas c
    where c.id = conversa_id
      and c.empresa_id = (select private.current_empresa_id())
      and (
        (select private.is_master_atlas())
        or c.responsavel_id = (select auth.uid())
        or exists (
          select 1 from public.atendimento_whatsapp_canais wc
          where wc.id = c.whatsapp_canal_id
            and wc.empresa_id = c.empresa_id
            and (
              wc.usuario_id = (select auth.uid())
              or (wc.principal = true and c.responsavel_id is null)
              or exists (
                select 1 from public.atendimento_whatsapp_permissoes p
                where p.canal_id = wc.id
                  and p.empresa_id = c.empresa_id
                  and p.usuario_id = (select auth.uid())
                  and (p.pode_supervisionar or (c.responsavel_id is null and p.pode_atender))
              )
            )
        )
      )
  )
);

drop policy if exists atendimento_eventos_select_v2 on public.atendimento_eventos;
drop policy if exists atendimento_eventos_select_v3 on public.atendimento_eventos;
create policy atendimento_eventos_select_v3
on public.atendimento_eventos for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and exists (
    select 1 from public.atendimento_conversas c
    where c.id = conversa_id
      and c.empresa_id = (select private.current_empresa_id())
      and (
        (select private.is_master_atlas())
        or c.responsavel_id = (select auth.uid())
        or exists (
          select 1 from public.atendimento_whatsapp_canais wc
          where wc.id = c.whatsapp_canal_id
            and wc.empresa_id = c.empresa_id
            and (
              wc.usuario_id = (select auth.uid())
              or (wc.principal = true and c.responsavel_id is null)
              or exists (
                select 1 from public.atendimento_whatsapp_permissoes p
                where p.canal_id = wc.id
                  and p.empresa_id = c.empresa_id
                  and p.usuario_id = (select auth.uid())
                  and (p.pode_supervisionar or (c.responsavel_id is null and p.pode_atender))
              )
            )
        )
      )
  )
);

comment on table public.atendimento_whatsapp_permissoes is
  'Autorizações adicionais por canal WhatsApp: visualizar, atender, transferir e supervisionar.';