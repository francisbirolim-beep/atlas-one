-- Preserve existing chat behavior while binding every read/participation check to the user's tenant.
create or replace function public.atlas_chat_participa(p_conversa uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select auth.uid() is not null
    and exists (
      select 1
      from public.chat_conversas c
      join public.usuarios u on u.id = auth.uid()
      where c.id = p_conversa
        and c.empresa_id = u.empresa_id
        and (
          u.role = 'master'
          or exists (
            select 1
            from public.chat_participantes cp
            where cp.conversa_id = c.id
              and cp.usuario_id = auth.uid()
          )
        )
    )
$function$;

create or replace function public.atlas_chat_pode_ler(p_conversa uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select auth.uid() is not null
    and exists (
      select 1
      from public.chat_conversas c
      join public.usuarios u on u.id = auth.uid()
      where c.id = p_conversa
        and c.empresa_id = u.empresa_id
        and (
          u.role = 'master'
          or exists (
            select 1
            from public.chat_participantes cp
            where cp.conversa_id = c.id
              and cp.usuario_id = auth.uid()
          )
        )
    )
$function$;
