create or replace function public.atlas_chat_pode_ler(p_conversa uuid)
returns boolean
language sql
stable
security definer
set search_path=public,auth
as $$
  select auth.uid() is not null and (
    exists(
      select 1
      from public.chat_participantes cp
      where cp.conversa_id=p_conversa
        and cp.usuario_id=auth.uid()
    )
    or exists(
      select 1
      from public.usuarios u
      where u.id=auth.uid()
        and u.role='master'
    )
  )
$$;

revoke all on function public.atlas_chat_pode_ler(uuid) from public,anon;
grant execute on function public.atlas_chat_pode_ler(uuid) to authenticated,service_role;

drop policy if exists chat_conversas_select on public.chat_conversas;
create policy chat_conversas_select on public.chat_conversas
for select to authenticated
using (public.atlas_chat_pode_ler(id));

drop policy if exists chat_participantes_select on public.chat_participantes;
create policy chat_participantes_select on public.chat_participantes
for select to authenticated
using (public.atlas_chat_pode_ler(conversa_id));

drop policy if exists chat_mensagens_select on public.chat_mensagens;
create policy chat_mensagens_select on public.chat_mensagens
for select to authenticated
using (public.atlas_chat_pode_ler(conversa_id));

create or replace function public.atlas_chat_listar_mensagens(p_conversa_id uuid)
returns setof public.chat_mensagens
language sql
security definer
set search_path=public,auth
as $$
 select m.*
 from public.chat_mensagens m
 where m.conversa_id=p_conversa_id
   and public.atlas_chat_pode_ler(p_conversa_id)
 order by m.created_at asc
 limit 500
$$;

revoke all on function public.atlas_chat_listar_mensagens(uuid) from public;
grant execute on function public.atlas_chat_listar_mensagens(uuid) to authenticated;