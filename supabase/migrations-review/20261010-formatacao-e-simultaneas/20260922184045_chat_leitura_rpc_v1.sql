create or replace function public.atlas_chat_listar_mensagens(p_conversa_id uuid)
returns setof public.chat_mensagens
language sql security definer set search_path=public,auth
as $$
 select m.* from public.chat_mensagens m
 where m.conversa_id=p_conversa_id
   and public.atlas_chat_participa(p_conversa_id)
 order by m.created_at asc limit 500
$$;
revoke all on function public.atlas_chat_listar_mensagens(uuid) from public;
grant execute on function public.atlas_chat_listar_mensagens(uuid) to authenticated;
