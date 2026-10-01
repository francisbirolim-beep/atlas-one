create or replace function public.atlas_chat_criar_conversa(
  p_nome text,
  p_tipo text,
  p_participantes uuid[]
) returns public.chat_conversas
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_usuario_nome text;
  v_conversa public.chat_conversas;
  v_pid uuid;
  v_pnome text;
  v_outros uuid[];
begin
  if v_uid is null then raise exception 'Sessão inválida'; end if;
  if p_tipo not in ('direta','grupo') then raise exception 'Tipo inválido'; end if;
  select nome into v_usuario_nome from public.usuarios where id=v_uid;
  if v_usuario_nome is null then raise exception 'Usuário inválido'; end if;

  select coalesce(array_agg(distinct x), '{}'::uuid[]) into v_outros
  from unnest(coalesce(p_participantes,'{}'::uuid[])) x
  where x is not null and x<>v_uid and exists(select 1 from public.usuarios u where u.id=x);

  if p_tipo='direta' and cardinality(v_outros)<>1 then raise exception 'Conversa direta exige 1 participante'; end if;
  if p_tipo='grupo' and cardinality(v_outros)<2 then raise exception 'Grupo exige 2 participantes'; end if;

  insert into public.chat_conversas(nome,tipo,criado_por_id,criado_por_nome)
  values(nullif(left(trim(coalesce(p_nome,'')),100),''),p_tipo,v_uid,v_usuario_nome)
  returning * into v_conversa;

  insert into public.chat_participantes(conversa_id,usuario_id,usuario_nome)
  values(v_conversa.id,v_uid,v_usuario_nome);

  foreach v_pid in array v_outros loop
    select nome into v_pnome from public.usuarios where id=v_pid;
    insert into public.chat_participantes(conversa_id,usuario_id,usuario_nome)
    values(v_conversa.id,v_pid,v_pnome);
  end loop;
  return v_conversa;
end $$;
revoke all on function public.atlas_chat_criar_conversa(text,text,uuid[]) from public;
grant execute on function public.atlas_chat_criar_conversa(text,text,uuid[]) to authenticated;
