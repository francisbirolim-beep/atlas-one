-- Verificacao server-side de sessao revogada, sem expor auth.sessions ao cliente.
create or replace function public.atlas_sessao_ativa_servidor(
  p_sessao uuid, p_usuario uuid
)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_sessao is not null and p_usuario is not null
  and exists (
    select 1 from auth.sessions s
    where s.id = p_sessao
      and s.user_id = p_usuario
      and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function public.atlas_sessao_ativa_servidor(uuid,uuid) from public, anon, authenticated;
grant execute on function public.atlas_sessao_ativa_servidor(uuid,uuid) to service_role;