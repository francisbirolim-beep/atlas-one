-- Permissões explícitas também no canal principal.
-- Master mantém acesso total; demais usuários dependem das permissões do painel.

drop policy if exists atendimento_whatsapp_canais_select_v2 on public.atendimento_whatsapp_canais;
drop policy if exists atendimento_whatsapp_canais_select_v3 on public.atendimento_whatsapp_canais;
create policy atendimento_whatsapp_canais_select_v3
on public.atendimento_whatsapp_canais for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (
    (select private.is_master_atlas())
    or usuario_id = (select auth.uid())
    or exists (
      select 1 from public.atendimento_whatsapp_permissoes p
      where p.canal_id = atendimento_whatsapp_canais.id
        and p.empresa_id = atendimento_whatsapp_canais.empresa_id
        and p.usuario_id = (select auth.uid())
        and (
          p.pode_visualizar
          or p.pode_atender
          or p.pode_transferir
          or p.pode_supervisionar
        )
    )
  )
);
drop policy if exists atendimento_conversas_select_v3 on public.atendimento_conversas;
drop policy if exists atendimento_conversas_select_v4 on public.atendimento_conversas;
create policy atendimento_conversas_select_v4
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
          or exists (
            select 1 from public.atendimento_whatsapp_permissoes p
            where p.canal_id = wc.id
              and p.empresa_id = atendimento_conversas.empresa_id
              and p.usuario_id = (select auth.uid())
              and (
                p.pode_supervisionar
                or (responsavel_id is null and p.pode_atender)
              )
          )
        )
    )
  )
);
drop policy if exists atendimento_sessoes_select_v3 on public.atendimento_sessoes;
drop policy if exists atendimento_sessoes_select_v4 on public.atendimento_sessoes;
create policy atendimento_sessoes_select_v4
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
drop policy if exists atendimento_mensagens_select_v3 on public.atendimento_mensagens;
drop policy if exists atendimento_mensagens_select_v4 on public.atendimento_mensagens;
create policy atendimento_mensagens_select_v4
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
drop policy if exists atendimento_eventos_select_v3 on public.atendimento_eventos;
drop policy if exists atendimento_eventos_select_v4 on public.atendimento_eventos;
create policy atendimento_eventos_select_v4
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