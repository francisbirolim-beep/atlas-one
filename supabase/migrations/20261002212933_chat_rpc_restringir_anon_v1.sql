revoke execute on function public.atlas_chat_criar_conversa(text,text,uuid[]) from public, anon;
revoke execute on function public.atlas_chat_enviar_mensagem(uuid,text,text,text,uuid,uuid,uuid) from public, anon;
revoke execute on function public.atlas_chat_listar_mensagens(uuid) from public, anon;
grant execute on function public.atlas_chat_criar_conversa(text,text,uuid[]) to authenticated;
grant execute on function public.atlas_chat_enviar_mensagem(uuid,text,text,text,uuid,uuid,uuid) to authenticated;
grant execute on function public.atlas_chat_listar_mensagens(uuid) to authenticated;
