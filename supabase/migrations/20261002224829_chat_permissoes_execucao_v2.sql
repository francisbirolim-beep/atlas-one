revoke insert, update, delete on public.chat_conversas from authenticated;
revoke insert, delete on public.chat_participantes from authenticated;
revoke insert, update, delete on public.chat_mensagens from authenticated;

grant select on public.chat_conversas, public.chat_participantes, public.chat_mensagens to authenticated;
grant update (ultima_leitura_em) on public.chat_participantes to authenticated;

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
  v_empresa uuid;
  v_role text;
  v_empresa_conversa uuid;
  v_chat_interno boolean := true;
  v_msg public.chat_mensagens;
begin
  if v_uid is null then raise exception 'Sessao nao autenticada'; end if;
  select u.nome, u.empresa_id, u.role into v_nome, v_empresa, v_role from public.usuarios u where u.id = v_uid;
  if v_empresa is null then raise exception 'Usuario sem empresa vinculada'; end if;
  select c.empresa_id into v_empresa_conversa from public.chat_conversas c where c.id = p_conversa_id;
  if v_empresa_conversa is null or v_empresa_conversa <> v_empresa then raise exception 'Conversa nao pertence a empresa do usuario'; end if;
  if v_role <> 'master' then
    select coalesce(p.chat_interno, true) into v_chat_interno
    from public.usuario_comunicacao_permissoes p
    where p.empresa_id = v_empresa and p.usuario_id = v_uid;
    if not coalesce(v_chat_interno, true) then raise exception 'Chat interno nao liberado para este usuario'; end if;
  end if;
  if not public.atlas_chat_participa(p_conversa_id) then raise exception 'Usuario nao participa da conversa'; end if;
  if coalesce(length(trim(p_texto)), 0) = 0 and coalesce(length(trim(p_anexo_url)), 0) = 0 then raise exception 'Mensagem vazia'; end if;
  if length(coalesce(trim(p_texto), '')) > 10000 then raise exception 'Mensagem muito longa'; end if;
  if length(coalesce(trim(p_anexo_nome), '')) > 255 then raise exception 'Nome do anexo muito longo'; end if;
  if p_anexo_url is not null and trim(p_anexo_url) !~ '^https://' then raise exception 'URL de anexo invalida'; end if;
  if p_mensagem_pai_id is not null and not exists (
    select 1 from public.chat_mensagens m where m.id = p_mensagem_pai_id and m.conversa_id = p_conversa_id
  ) then raise exception 'Mensagem respondida nao pertence a conversa'; end if;
  if p_cliente_id is not null and not exists (
    select 1 from public.clientes c where c.id = p_cliente_id and c.empresa_id = v_empresa
  ) then raise exception 'Cliente nao pertence a empresa do usuario'; end if;
  if p_orcamento_id is not null and not exists (
    select 1 from public.orcamentos o where o.id = p_orcamento_id and o.empresa_id = v_empresa
  ) then raise exception 'Orcamento nao pertence a empresa do usuario'; end if;
  insert into public.chat_mensagens(conversa_id,usuario_id,usuario_nome,texto,anexo_url,anexo_nome,cliente_id,orcamento_id,mensagem_pai_id)
  values(p_conversa_id,v_uid,coalesce(v_nome,'Usuario'),nullif(trim(p_texto),''),nullif(trim(p_anexo_url),''),nullif(trim(p_anexo_nome),''),p_cliente_id,p_orcamento_id,p_mensagem_pai_id)
  returning * into v_msg;
  update public.chat_conversas set updated_at = now() where id = p_conversa_id and empresa_id = v_empresa;
  return v_msg;
end
$$;

create or replace function public.atlas_chat_listar_mensagens(p_conversa_id uuid)
returns setof public.chat_mensagens
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_empresa uuid;
  v_role text;
  v_chat_interno boolean := true;
  v_empresa_conversa uuid;
begin
  if v_uid is null then raise exception 'Sessao nao autenticada'; end if;
  select u.empresa_id, u.role into v_empresa, v_role from public.usuarios u where u.id = v_uid;
  select c.empresa_id into v_empresa_conversa from public.chat_conversas c where c.id = p_conversa_id;
  if v_empresa is null or v_empresa_conversa is null or v_empresa <> v_empresa_conversa then raise exception 'Conversa nao autorizada'; end if;
  if v_role <> 'master' then
    select coalesce(p.chat_interno, true) into v_chat_interno
    from public.usuario_comunicacao_permissoes p
    where p.empresa_id = v_empresa and p.usuario_id = v_uid;
    if not coalesce(v_chat_interno, true) then raise exception 'Chat interno nao liberado para este usuario'; end if;
    if not public.atlas_chat_participa(p_conversa_id) then raise exception 'Usuario nao participa da conversa'; end if;
  end if;
  return query
  select m.* from public.chat_mensagens m where m.conversa_id = p_conversa_id order by m.created_at asc limit 500;
end
$$;

revoke all on function public.atlas_chat_enviar_mensagem(uuid,text,text,text,uuid,uuid,uuid) from public, anon;
revoke all on function public.atlas_chat_listar_mensagens(uuid) from public, anon;
grant execute on function public.atlas_chat_enviar_mensagem(uuid,text,text,text,uuid,uuid,uuid) to authenticated;
grant execute on function public.atlas_chat_listar_mensagens(uuid) to authenticated;
