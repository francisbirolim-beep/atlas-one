begin;
set local lock_timeout='1s';
set local statement_timeout='10s';
-- Recebe exclusivamente mensagem de entrada já persistida pelo gateway.
-- Sem trigger, sem mudança nas mensagens comuns ou grupos.
create function public.atlas_chat_direcionar_arroba(
 p_empresa uuid,p_canal uuid,p_mensagem uuid,p_anterior uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare m record; c record; ca record; u record; a record; pe record; cmd text[];
begin
 select * into m from public.atendimento_mensagens where id=p_mensagem and empresa_id=p_empresa and direcao='entrada' and tipo='texto';
 if not found then return null; end if;
 cmd:=regexp_match(btrim(m.texto),'^@([a-z][a-z0-9_]{1,29})([[:space:]]|$)','i');
 if cmd is null then return null; end if;
 select * into c from public.atendimento_conversas where id=m.conversa_id and empresa_id=p_empresa and whatsapp_canal_id=p_canal for update;
 if not found or c.whatsapp_chat_tipo is distinct from 'contato' or c.canal is distinct from 'whatsapp'
 or c.telefone !~ '^55[1-9][0-9]{9,10}$' or c.whatsapp_chat_jid is distinct from c.telefone||'@s.whatsapp.net'
 or c.responsavel_id is distinct from p_anterior or c.status is distinct from 'aguardando'
 or c.ocultar_da_caixa is distinct from false then return null; end if;
 if exists(select 1 from public.atendimento_mensagens x where x.empresa_id=p_empresa and x.conversa_id=c.id and (x.created_at,x.id)>(m.created_at,m.id)) then return null; end if;
 if (select count(*) from public.atendimento_conversas where empresa_id=p_empresa and whatsapp_canal_id=p_canal and whatsapp_chat_tipo='contato' and telefone=c.telefone)<>1 then return null; end if;
 if exists(select 1 from public.atendimento_eventos where empresa_id=p_empresa and conversa_id=c.id and tipo='atlas_chat_arroba_direto' and dados->>'mensagem_id'=p_mensagem::text) then return null; end if;
 select * into ca from public.atendimento_whatsapp_canais where empresa_id=p_empresa and id=p_canal for share;
 if not found or ca.principal is distinct from true or ca.ativo is distinct from true then return null; end if;
 select * into a from public.atlas_chat_arrobas where empresa_id=p_empresa and apelido=lower(cmd[1]) and publico=true for share;
 if not found then return null; end if;
 select id,nome,role into u from public.usuarios where empresa_id=p_empresa and id=a.usuario_id for share;
 if not found then return null; end if;
 perform 1 from public.atlas_chat_acessos where empresa_id=p_empresa and usuario_id=u.id and habilitado=true for share;
 if not found then return null; end if;
 if u.role is distinct from 'master' and ca.usuario_id is distinct from u.id then
  select pode_atender into pe from public.atendimento_whatsapp_permissoes where empresa_id=p_empresa and canal_id=p_canal and usuario_id=u.id for share;
  if not found or pe.pode_atender is distinct from true then return null; end if;
 end if;
 update public.atendimento_conversas set responsavel_id=u.id,responsavel_nome=u.nome,updated_at=clock_timestamp() where id=c.id and empresa_id=p_empresa;
 update public.atendimento_sessoes set responsavel_id=u.id,responsavel_nome=u.nome,status='aguardando',assigned_at=null
 where id=m.sessao_id and empresa_id=p_empresa and conversa_id=c.id and closed_at is null;
 insert into public.atlas_chat_vinculos(empresa_id,canal_id,telefone,responsavel_id,atualizado_por,updated_at)
 values(p_empresa,p_canal,c.telefone,u.id,null,clock_timestamp())
 on conflict(empresa_id,canal_id,telefone) do update set responsavel_id=excluded.responsavel_id,atualizado_por=null,updated_at=excluded.updated_at;
 insert into public.atendimento_eventos(empresa_id,conversa_id,sessao_id,tipo,dados)
 values(p_empresa,c.id,m.sessao_id,'atlas_chat_arroba_direto',jsonb_build_object('mensagem_id',p_mensagem,'anterior',p_anterior,'destino',u.id,'apelido',lower(cmd[1])));
 return jsonb_build_object('id',u.id,'nome',u.nome);
end; $$;
revoke all on function public.atlas_chat_direcionar_arroba(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.atlas_chat_direcionar_arroba(uuid,uuid,uuid,uuid) to service_role;
commit;
