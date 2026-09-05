alter table public.agente_conversas alter column empresa_id set not null;
alter table public.agente_mensagens alter column empresa_id set not null;
alter table public.agente_memorias alter column empresa_id set not null;
alter table public.ai_interacoes alter column empresa_id set not null;
alter table public.ai_memorias alter column empresa_id set not null;
alter table public.ai_feedback alter column empresa_id set not null;
alter table public.ia_uso_log alter column empresa_id set not null;

drop policy if exists agente_conversas_own on public.agente_conversas;
create policy agente_conversas_own_tenant
on public.agente_conversas
for all
to authenticated
using (
  usuario_id = (select auth.uid())
  and empresa_id = (select private.current_empresa_id())
)
with check (
  usuario_id = (select auth.uid())
  and empresa_id = (select private.current_empresa_id())
);

drop policy if exists agente_memorias_own on public.agente_memorias;
create policy agente_memorias_own_tenant
on public.agente_memorias
for all
to authenticated
using (
  usuario_id = (select auth.uid())
  and empresa_id = (select private.current_empresa_id())
)
with check (
  usuario_id = (select auth.uid())
  and empresa_id = (select private.current_empresa_id())
);

drop policy if exists agente_mensagens_own on public.agente_mensagens;
create policy agente_mensagens_own_tenant
on public.agente_mensagens
for all
to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and exists (
    select 1
    from public.agente_conversas c
    where c.id = agente_mensagens.conversa_id
      and c.usuario_id = (select auth.uid())
      and c.empresa_id = agente_mensagens.empresa_id
  )
)
with check (
  empresa_id = (select private.current_empresa_id())
  and exists (
    select 1
    from public.agente_conversas c
    where c.id = agente_mensagens.conversa_id
      and c.usuario_id = (select auth.uid())
      and c.empresa_id = agente_mensagens.empresa_id
  )
);