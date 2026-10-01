create or replace function public.atlas_chat_participa(p_conversa uuid) returns boolean language sql stable security definer set search_path=public,auth as $$ select auth.uid() is not null and exists(select 1 from public.chat_participantes cp where cp.conversa_id=p_conversa and cp.usuario_id=auth.uid()) $$;
revoke all on function public.atlas_chat_participa(uuid) from public,anon,authenticated;
grant execute on function public.atlas_chat_participa(uuid) to postgres, service_role;
