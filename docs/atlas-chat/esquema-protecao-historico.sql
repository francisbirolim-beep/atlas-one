-- RASCUNHO: somente banco descartável. Não aplicar à produção.
-- Registro explícito limita a proteção ao piloto; não registrar toda a base.
begin;
create schema atlas_chat_privado;
revoke all on schema atlas_chat_privado from public,anon,authenticated;
create table atlas_chat_privado.conversas_protegidas(
 empresa_id uuid not null, conversa_id uuid not null,
 primary key(empresa_id,conversa_id)
);
revoke all on atlas_chat_privado.conversas_protegidas from public,anon,authenticated,service_role;
-- A função é privada, não tem entrada externa e usa apenas os dados do trigger.
-- SECURITY DEFINER permite verificar registro privado sem dar acesso a usuários.
create function atlas_chat_privado.bloquear_exclusao() returns trigger
 language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if tg_op='TRUNCATE' then
  if exists(select 1 from atlas_chat_privado.conversas_protegidas) then
   raise exception 'Histórico protegido: truncamento proibido';
  end if;
  return null;
 end if;
 if tg_table_name='atendimento_conversas' then cid:=old.id; else cid:=old.conversa_id; end if;
 if exists(select 1 from atlas_chat_privado.conversas_protegidas p where p.empresa_id=old.empresa_id and p.conversa_id=cid) then
  raise exception 'Histórico protegido: exclusão física proibida';
 end if;
 return old;
end; $$;
revoke all on function atlas_chat_privado.bloquear_exclusao() from public,anon,authenticated,service_role;
create trigger atlas_chat_proteger_conversa before delete on public.atendimento_conversas for each row execute function atlas_chat_privado.bloquear_exclusao();
create trigger atlas_chat_proteger_mensagem before delete on public.atendimento_mensagens for each row execute function atlas_chat_privado.bloquear_exclusao();
create trigger atlas_chat_proteger_truncate_conversa before truncate on public.atendimento_conversas for each statement execute function atlas_chat_privado.bloquear_exclusao();
create trigger atlas_chat_proteger_truncate_mensagem before truncate on public.atendimento_mensagens for each statement execute function atlas_chat_privado.bloquear_exclusao();
commit;
