begin;
set local lock_timeout='1s';
set local statement_timeout='15s';
-- A atribuição de uma mensagem é independente do responsável atual da conversa.
create table public.atlas_chat_mensagem_responsavel(
 mensagem_id uuid primary key references public.atendimento_mensagens(id) on delete cascade,
 empresa_id uuid not null, conversa_id uuid not null, usuario_id uuid not null,
 criado_em timestamptz not null
);
alter table public.atlas_chat_mensagem_responsavel enable row level security;
revoke all on public.atlas_chat_mensagem_responsavel from public,anon,authenticated;
grant select on public.atlas_chat_mensagem_responsavel to service_role;
create index atlas_chat_mensagem_responsavel_busca on public.atlas_chat_mensagem_responsavel(empresa_id,usuario_id,conversa_id,criado_em desc,mensagem_id desc);
create or replace function public.atlas_chat_registrar_responsavel_mensagem()
returns trigger language plpgsql security definer set search_path='' as $$
declare destino uuid;
begin
 select case when new.direcao='saida' then new.usuario_id
             when new.direcao='entrada' then c.responsavel_id end into destino
 from public.atendimento_conversas c join public.atendimento_whatsapp_canais ca
 on ca.id=c.whatsapp_canal_id and ca.empresa_id=c.empresa_id
 where c.id=new.conversa_id and c.empresa_id=new.empresa_id
 and c.canal='whatsapp' and c.whatsapp_chat_tipo='contato' and ca.principal=true;
 -- Comandos de troca só ganham destinatário depois da confirmação auditada.
 if new.direcao='entrada' and new.tipo='texto' and btrim(coalesce(new.texto,'')) ~* '^@[a-z][a-z0-9_]{1,29}([[:space:]]|$)' then return new; end if;
 if destino is not null and exists(select 1 from public.usuarios u where u.id=destino and u.empresa_id=new.empresa_id) then
 insert into public.atlas_chat_mensagem_responsavel values(new.id,new.empresa_id,new.conversa_id,destino,new.created_at)
 on conflict(mensagem_id) do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.atlas_chat_registrar_responsavel_mensagem() from public,anon,authenticated;
create trigger atlas_chat_responsavel_mensagem_insert after insert on public.atendimento_mensagens
for each row execute function public.atlas_chat_registrar_responsavel_mensagem();
create or replace function public.atlas_chat_registrar_responsavel_arroba()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.tipo='atlas_chat_arroba_direto' then
 insert into public.atlas_chat_mensagem_responsavel
 select m.id,m.empresa_id,m.conversa_id,u.id,m.created_at
 from public.atendimento_mensagens m
 join public.usuarios u on u.id::text=new.dados->>'destino' and u.empresa_id=m.empresa_id
 where m.id::text=new.dados->>'mensagem_id' and m.empresa_id=new.empresa_id
 and m.conversa_id=new.conversa_id and m.direcao='entrada'
 on conflict(mensagem_id) do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.atlas_chat_registrar_responsavel_arroba() from public,anon,authenticated;
create trigger atlas_chat_responsavel_arroba_insert after insert on public.atendimento_eventos
for each row execute function public.atlas_chat_registrar_responsavel_arroba();
-- Leituras só pelo backend autenticado. Histórico antigo sem atribuição não é adivinhado.
create function public.atlas_chat_mensagens_individuais(p_empresa uuid,p_usuario uuid,p_conversa uuid,p_antes_em timestamptz default null,p_antes_id uuid default null)
returns setof public.atendimento_mensagens language sql stable security invoker set search_path='' as $$
 select m.* from public.atlas_chat_mensagem_responsavel r join public.atendimento_mensagens m
 on m.id=r.mensagem_id and m.empresa_id=r.empresa_id and m.conversa_id=r.conversa_id
 where r.empresa_id=p_empresa and r.usuario_id=p_usuario and r.conversa_id=p_conversa
 and (p_antes_em is null or (r.criado_em,r.mensagem_id)<(p_antes_em,p_antes_id))
 order by r.criado_em desc,r.mensagem_id desc limit 251;
$$;
revoke all on function public.atlas_chat_mensagens_individuais(uuid,uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.atlas_chat_mensagens_individuais(uuid,uuid,uuid,timestamptz,uuid) to service_role;
-- Marcador de leitura por usuário; não altera o contador da central.
create table public.atlas_chat_leituras_individuais(
 empresa_id uuid not null,usuario_id uuid not null,conversa_id uuid not null,
 ultimo_em timestamptz not null,ultima_mensagem_id uuid not null,
 primary key(empresa_id,usuario_id,conversa_id)
);
alter table public.atlas_chat_leituras_individuais enable row level security;
revoke all on public.atlas_chat_leituras_individuais from public,anon,authenticated;
grant select,insert,update on public.atlas_chat_leituras_individuais to service_role;
create function public.atlas_chat_marcar_lida(p_empresa uuid,p_usuario uuid,p_conversa uuid,p_mensagem uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare momento timestamptz;
begin
 select criado_em into momento from public.atlas_chat_mensagem_responsavel
 where empresa_id=p_empresa and usuario_id=p_usuario and conversa_id=p_conversa and mensagem_id=p_mensagem;
 if not found then return false; end if;
 insert into public.atlas_chat_leituras_individuais as l values(p_empresa,p_usuario,p_conversa,momento,p_mensagem)
 on conflict(empresa_id,usuario_id,conversa_id) do update
 set ultimo_em=excluded.ultimo_em,ultima_mensagem_id=excluded.ultima_mensagem_id
 where (l.ultimo_em,l.ultima_mensagem_id)<(excluded.ultimo_em,excluded.ultima_mensagem_id);
 return true;
end; $$;
revoke all on function public.atlas_chat_marcar_lida(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.atlas_chat_marcar_lida(uuid,uuid,uuid,uuid) to service_role;
-- Lista individual: conversas atuais e histórico comprovado do próprio usuário.
-- Nenhum preview ou contador global é exposto.
create function public.atlas_chat_caixa_individual(p_empresa uuid,p_usuario uuid,p_canal uuid)
returns table(id uuid,telefone text,contato_nome text,ultimo_preview text,nao_lidas integer,status text,ultima_mensagem_em timestamptz)
language sql stable security invoker set search_path='' as $$
 with ultimas as (
 select distinct on (r.conversa_id) r.conversa_id,r.mensagem_id,r.criado_em
 from public.atlas_chat_mensagem_responsavel r
 where r.empresa_id=p_empresa and r.usuario_id=p_usuario
 order by r.conversa_id,r.criado_em desc,r.mensagem_id desc
 ), nao_lidas_por_conversa as (
 select r.conversa_id,count(*)::integer as total
 from public.atlas_chat_mensagem_responsavel r
 join public.atendimento_mensagens m on m.id=r.mensagem_id and m.empresa_id=r.empresa_id and m.conversa_id=r.conversa_id
 left join public.atlas_chat_leituras_individuais l on l.empresa_id=r.empresa_id and l.usuario_id=r.usuario_id and l.conversa_id=r.conversa_id
 where r.empresa_id=p_empresa and r.usuario_id=p_usuario and m.direcao='entrada'
 and (l.ultimo_em is null or (r.criado_em,r.mensagem_id)>(l.ultimo_em,l.ultima_mensagem_id))
 group by r.conversa_id
 )
 select c.id,c.telefone,c.contato_nome,m.texto,coalesce(n.total,0),
 case when c.responsavel_id=p_usuario then c.status else 'historico' end,
 coalesce(u.criado_em,c.created_at)
 from public.atendimento_conversas c left join ultimas u on u.conversa_id=c.id
 left join nao_lidas_por_conversa n on n.conversa_id=c.id
 left join public.atendimento_mensagens m on m.id=u.mensagem_id and m.empresa_id=c.empresa_id and m.conversa_id=c.id
 where c.empresa_id=p_empresa and c.whatsapp_canal_id=p_canal and c.whatsapp_chat_tipo='contato'
 and c.canal='whatsapp' and c.ocultar_da_caixa=false and (c.responsavel_id=p_usuario or u.mensagem_id is not null)
 order by coalesce(u.criado_em,c.created_at) desc,c.id;
$$;
revoke all on function public.atlas_chat_caixa_individual(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.atlas_chat_caixa_individual(uuid,uuid,uuid) to service_role;
-- Importação conservadora: apenas lotes explícitos e autoria comprovada.
-- Mensagens antigas sem prova de destinatário permanecem exclusivamente na central.
create function public.atlas_chat_importar_mensagens_atribuidas(p_empresa uuid,p_ids uuid[])
returns integer language plpgsql security invoker set search_path='' as $$
declare total integer;
begin
 if coalesce(cardinality(p_ids),0)>500 then raise exception 'Lote superior a 500 mensagens'; end if;
 insert into public.atlas_chat_mensagem_responsavel
 select m.id,m.empresa_id,m.conversa_id,u.id,m.created_at
 from public.atendimento_mensagens m
 join public.atendimento_conversas c on c.id=m.conversa_id and c.empresa_id=m.empresa_id
 join public.atendimento_whatsapp_canais ca on ca.id=c.whatsapp_canal_id and ca.empresa_id=c.empresa_id
 join public.usuarios u on u.empresa_id=m.empresa_id and u.id::text=case
 when m.direcao='saida' then m.usuario_id::text
 when m.direcao='entrada' then (
 select case when count(distinct ev.dados->>'destino')=1 then min(ev.dados->>'destino') end
 from public.atendimento_eventos ev where ev.empresa_id=m.empresa_id and ev.conversa_id=m.conversa_id
 and ev.tipo='atlas_chat_arroba_direto' and ev.dados->>'mensagem_id'=m.id::text
 ) end
 where m.empresa_id=p_empresa and m.id=any(p_ids) and c.canal='whatsapp'
 and c.whatsapp_chat_tipo='contato' and ca.principal=true
 on conflict(mensagem_id) do nothing;
 get diagnostics total=row_count;
 return total;
end; $$;
revoke all on function public.atlas_chat_importar_mensagens_atribuidas(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.atlas_chat_importar_mensagens_atribuidas(uuid,uuid[]) to service_role;
grant insert on public.atlas_chat_mensagem_responsavel to service_role;
-- Usuários sem acesso à central não podem contornar o endpoint individual
-- consultando diretamente as tabelas antigas de contatos do canal principal.
-- A política anterior continua em vigor para a central e para grupos.
create function public.atlas_chat_bloquear_leitura_direta(p_empresa uuid,p_conversa uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
 select 1 from public.atlas_chat_acessos a
 where a.empresa_id=p_empresa and a.usuario_id=(select auth.uid())
 and a.central_habilitado=false
 and exists(select 1 from public.atendimento_conversas c join public.atendimento_whatsapp_canais ca
 on ca.id=c.whatsapp_canal_id and ca.empresa_id=c.empresa_id
 where c.id=p_conversa and c.empresa_id=p_empresa and c.canal='whatsapp'
 and c.whatsapp_chat_tipo='contato' and ca.principal=true)
 );
$$;
revoke all on function public.atlas_chat_bloquear_leitura_direta(uuid,uuid) from public,anon;
grant execute on function public.atlas_chat_bloquear_leitura_direta(uuid,uuid) to authenticated;
create policy atlas_chat_conversas_individual_guard on public.atendimento_conversas as restrictive
for select to authenticated using (not public.atlas_chat_bloquear_leitura_direta(empresa_id,id));
create policy atlas_chat_mensagens_individual_guard on public.atendimento_mensagens as restrictive
for select to authenticated using (not public.atlas_chat_bloquear_leitura_direta(empresa_id,conversa_id));
create policy atlas_chat_eventos_individual_guard on public.atendimento_eventos as restrictive
for select to authenticated using (not public.atlas_chat_bloquear_leitura_direta(empresa_id,conversa_id));
create policy atlas_chat_sessoes_individual_guard on public.atendimento_sessoes as restrictive
for select to authenticated using (not public.atlas_chat_bloquear_leitura_direta(empresa_id,conversa_id));
commit;
