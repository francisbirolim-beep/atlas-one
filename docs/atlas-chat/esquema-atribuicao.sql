-- Rascunho para PostgreSQL isolado. Não aplicar em produção.
-- Reabre somente conversa finalizada e com vínculo explicitamente autorizado.
begin;
create function public.atlas_chat_atribuir_encerrada(
 p_empresa uuid,p_canal uuid,p_conversa uuid,p_telefone text,
 p_responsavel_anterior uuid,p_atualizado_em timestamptz,p_destino uuid
) returns text language plpgsql security invoker set search_path='' as $$
declare c record; v record; u record; a record; canal record; permissao record;
begin
 if p_destino is null or p_telefone !~ '^55[1-9][0-9]{9,10}$' or p_atualizado_em is null then return 'invalido'; end if;
 select * into c from public.atendimento_conversas where id=p_conversa and empresa_id=p_empresa and whatsapp_canal_id=p_canal for update;
 if not found or c.status is distinct from 'finalizado' or c.whatsapp_chat_tipo is distinct from 'contato'
 or c.telefone is distinct from p_telefone or c.whatsapp_chat_jid is distinct from p_telefone||'@s.whatsapp.net'
 or c.responsavel_id is distinct from p_responsavel_anterior or c.updated_at is distinct from p_atualizado_em then return 'conflito'; end if;
 if (select count(*) from public.atendimento_conversas where empresa_id=p_empresa and whatsapp_canal_id=p_canal and whatsapp_chat_tipo='contato' and telefone=p_telefone)<>1 then return 'ambiguo'; end if;
 select * into canal from public.atendimento_whatsapp_canais where id=p_canal and empresa_id=p_empresa for share;
 if not found or canal.principal is distinct from true or canal.ativo is distinct from true then return 'canal'; end if;
 select * into v from public.atlas_chat_vinculos where empresa_id=p_empresa and canal_id=p_canal and telefone=p_telefone for share;
 if not found or v.responsavel_id is distinct from p_destino then return 'vinculo'; end if;
 select id,nome,role into u from public.usuarios where id=p_destino and empresa_id=p_empresa for share;
 if not found then return 'acesso'; end if;
 select habilitado into a from public.atlas_chat_acessos where empresa_id=p_empresa and usuario_id=p_destino for share;
 if not found or a.habilitado is distinct from true then return 'acesso'; end if;
 if u.role is distinct from 'master' and canal.usuario_id is distinct from p_destino then
  select pode_atender into permissao from public.atendimento_whatsapp_permissoes where empresa_id=p_empresa and canal_id=p_canal and usuario_id=p_destino for share;
  if not found or permissao.pode_atender is distinct from true then return 'acesso'; end if;
 end if;
 update public.atendimento_conversas set responsavel_id=p_destino,responsavel_nome=u.nome,status='aguardando',updated_at=clock_timestamp()
 where id=p_conversa and empresa_id=p_empresa;
 insert into public.atendimento_eventos(empresa_id,conversa_id,tipo,dados)
 values(p_empresa,p_conversa,'atlas_chat_vinculo_reatribuido',jsonb_build_object('anterior',p_responsavel_anterior,'destino',p_destino));
 return 'atribuido';
end; $$;
revoke all on function public.atlas_chat_atribuir_encerrada(uuid,uuid,uuid,text,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.atlas_chat_atribuir_encerrada(uuid,uuid,uuid,text,uuid,timestamptz,uuid) to service_role;
commit;
