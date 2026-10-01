create or replace function public.atlas_chat_enviar_mensagem(
  p_conversa_id uuid,
  p_texto text default null,
  p_anexo_url text default null,
  p_anexo_nome text default null,
  p_cliente_id uuid default null,
  p_orcamento_id uuid default null,
  p_mensagem_pai_id uuid default null
) returns public.chat_mensagens
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_nome text;
  v_msg public.chat_mensagens;
begin
  if v_uid is null then raise exception 'Sessao nao autenticada'; end if;
  if not public.atlas_chat_participa(p_conversa_id) then raise exception 'Usuario nao participa da conversa'; end if;
  if coalesce(length(trim(p_texto)),0)=0 and coalesce(length(trim(p_anexo_url)),0)=0 then raise exception 'Mensagem vazia'; end if;
  if length(coalesce(trim(p_texto),'')) > 10000 then raise exception 'Mensagem muito longa'; end if;
  if length(coalesce(trim(p_anexo_nome),'')) > 255 then raise exception 'Nome do anexo muito longo'; end if;
  if p_anexo_url is not null and trim(p_anexo_url) !~ '^https://' then raise exception 'URL de anexo invalida'; end if;
  select nome into v_nome from public.usuarios where id=v_uid;
  insert into public.chat_mensagens(conversa_id,usuario_id,usuario_nome,texto,anexo_url,anexo_nome,cliente_id,orcamento_id,mensagem_pai_id)
  values(p_conversa_id,v_uid,coalesce(v_nome,'Usuario'),nullif(trim(p_texto),''),nullif(trim(p_anexo_url),''),nullif(trim(p_anexo_nome),''),p_cliente_id,p_orcamento_id,p_mensagem_pai_id)
  returning * into v_msg;
  update public.chat_conversas set updated_at=now() where id=p_conversa_id;
  return v_msg;
end $$;
revoke all on function public.atlas_chat_enviar_mensagem(uuid,text,text,text,uuid,uuid,uuid) from public;
grant execute on function public.atlas_chat_enviar_mensagem(uuid,text,text,text,uuid,uuid,uuid) to authenticated;
