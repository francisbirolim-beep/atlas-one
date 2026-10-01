create or replace function public.atlas_chat_criar_conversa(p_nome text,p_tipo text,p_participantes uuid[])
returns public.chat_conversas
language plpgsql security definer set search_path=public,auth
as $$
declare v_uid uuid:=auth.uid(); v_nome text; v_outros uuid[]; v_conv public.chat_conversas; v_id uuid;
begin
 if v_uid is null then raise exception 'Sessao nao autenticada'; end if;
 select nome into v_nome from public.usuarios where id=v_uid;
 select coalesce(array_agg(distinct u.id order by u.id),'{}'::uuid[]) into v_outros from public.usuarios u where u.id=any(coalesce(p_participantes,'{}'::uuid[])) and u.id<>v_uid;
 if p_tipo='direta' then
   if cardinality(v_outros)<>1 then raise exception 'Conversa direta exige um participante'; end if;
   select c.id into v_id from public.chat_conversas c
   where c.tipo='direta'
     and exists(select 1 from public.chat_participantes p where p.conversa_id=c.id and p.usuario_id=v_uid)
     and exists(select 1 from public.chat_participantes p where p.conversa_id=c.id and p.usuario_id=v_outros[1])
     and (select count(*) from public.chat_participantes p where p.conversa_id=c.id)=2
   order by c.updated_at desc limit 1;
   if v_id is not null then select * into v_conv from public.chat_conversas where id=v_id; return v_conv; end if;
 elsif p_tipo='grupo' then
   if cardinality(v_outros)<2 then raise exception 'Grupo exige ao menos dois participantes'; end if;
 else raise exception 'Tipo de conversa invalido';
 end if;
 insert into public.chat_conversas(nome,tipo,criado_por_id,criado_por_nome) values(nullif(trim(p_nome),''),p_tipo,v_uid,coalesce(v_nome,'Usuario')) returning * into v_conv;
 insert into public.chat_participantes(conversa_id,usuario_id,usuario_nome) values(v_conv.id,v_uid,coalesce(v_nome,'Usuario'));
 insert into public.chat_participantes(conversa_id,usuario_id,usuario_nome)
 select v_conv.id,u.id,u.nome from public.usuarios u where u.id=any(v_outros) on conflict(conversa_id,usuario_id) do nothing;
 return v_conv;
end $$;
revoke all on function public.atlas_chat_criar_conversa(text,text,uuid[]) from public;
grant execute on function public.atlas_chat_criar_conversa(text,text,uuid[]) to authenticated;
