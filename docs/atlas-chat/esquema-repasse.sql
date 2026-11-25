-- Rascunho de homologação: executor por conversa; não agenda nem altera produção.
begin;
create table public.atlas_chat_repasse_config (
 empresa_id uuid primary key references public.empresas(id) on delete cascade,
 ativo boolean not null default false,
 destino_id uuid not null,
 prazo_minutos integer not null check(prazo_minutos between 1 and 1440),
 foreign key(empresa_id,destino_id) references public.usuarios(empresa_id,id) on delete cascade
);
alter table public.atlas_chat_repasse_config enable row level security;
revoke all on public.atlas_chat_repasse_config from public,anon,authenticated;
grant select,insert,update on public.atlas_chat_repasse_config to service_role;
create function public.atlas_chat_repassar_pendencia(p_empresa uuid,p_conversa uuid,p_destino_esperado uuid)
 returns text language plpgsql security invoker set search_path='' as $$
declare c record; d record; cfg record; canal record; u record; a record; p record; s record; instante timestamptz;
begin
 select * into c from public.atendimento_conversas where empresa_id=p_empresa and id=p_conversa for update;
 if not found or c.status is distinct from 'aguardando' or c.whatsapp_chat_tipo is distinct from 'contato' or c.ocultar_da_caixa is distinct from false then return 'inelegivel'; end if;
 select * into cfg from public.atlas_chat_repasse_config where empresa_id=p_empresa for share;
 if not found or not cfg.ativo then return 'desligado'; end if;
 if cfg.destino_id is distinct from p_destino_esperado then return 'config_alterada'; end if;
 select * into d from public.atendimento_whatsapp_distribuicao where empresa_id=p_empresa for share;
 if not found or not d.ativo or d.usuario_principal_id is null or c.responsavel_id is distinct from d.usuario_principal_id or cfg.destino_id=d.usuario_principal_id or not coalesce(cfg.destino_id=any(d.secundarios_ids),false) then return 'inelegivel'; end if;
 instante:=clock_timestamp();
 if c.ultima_entrada_em is null or c.ultima_entrada_em>instante-make_interval(mins=>cfg.prazo_minutos) or (c.ultima_saida_em is not null and c.ultima_saida_em>=c.ultima_entrada_em) then return 'prazo'; end if;
 select * into canal from public.atendimento_whatsapp_canais where empresa_id=p_empresa and id=c.whatsapp_canal_id for share;
 if not found or canal.principal is distinct from true or canal.ativo is distinct from true then return 'canal'; end if;
 select id,nome,role into u from public.usuarios where empresa_id=p_empresa and id=cfg.destino_id for share;
 if not found then return 'acesso'; end if;
 select habilitado into a from public.atlas_chat_acessos where empresa_id=p_empresa and usuario_id=cfg.destino_id for share;
 if not found or not a.habilitado then return 'acesso'; end if;
 if u.role is distinct from 'master' and canal.usuario_id is distinct from cfg.destino_id then
  select pode_atender into p from public.atendimento_whatsapp_permissoes where empresa_id=p_empresa and canal_id=canal.id and usuario_id=cfg.destino_id for share;
  if not found or p.pode_atender is distinct from true then return 'acesso'; end if;
 end if;
 if (select count(*) from public.atendimento_sessoes where empresa_id=p_empresa and conversa_id=c.id and closed_at is null)<>1 then return 'sessao'; end if;
 select * into s from public.atendimento_sessoes where empresa_id=p_empresa and conversa_id=c.id and closed_at is null for update;
 if not found or s.responsavel_id is distinct from c.responsavel_id or s.status is distinct from 'aguardando' or s.first_response_at is not null then return 'sessao'; end if;
 update public.atendimento_conversas set responsavel_id=u.id,responsavel_nome=u.nome,updated_at=instante where id=c.id and empresa_id=p_empresa;
 update public.atendimento_sessoes set responsavel_id=u.id,responsavel_nome=u.nome,assigned_at=null where id=s.id and empresa_id=p_empresa;
 insert into public.atendimento_eventos(empresa_id,conversa_id,sessao_id,tipo,dados)
 values(p_empresa,c.id,s.id,'atlas_chat_repasse_automatico',jsonb_build_object('anterior',c.responsavel_id,'destino',u.id,'prazo_minutos',cfg.prazo_minutos));
 insert into public.notificacoes(empresa_id,usuario_id,categoria,tipo,titulo,mensagem,href,origem_tipo,origem_id,push_status)
 values(p_empresa,u.id,'chat','whatsapp_transferencia','Atlas Chat · Atendimento encaminhado','Abra sua caixa para consultar o atendimento.','/atlas-chat?usuario='||u.id||'&conversaId='||c.id,'atlas_chat_repasse_automatico',c.id||':'||instante,'pendente');
 return 'repassado';
end; $$;
revoke all on function public.atlas_chat_repassar_pendencia(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.atlas_chat_repassar_pendencia(uuid,uuid,uuid) to service_role;
commit;
