create or replace function private.usuario_pode_editar_setor(p_usuario_id uuid, p_empresa_id uuid, p_setor_id text)
returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.usuarios u where u.id=p_usuario_id and u.empresa_id=p_empresa_id and (u.role='master' or exists(select 1 from public.permissoes p where p.usuario_id=u.id and p.empresa_id=p_empresa_id and p.setor_id=p_setor_id and p.nivel='edicao')));
$$;
revoke all on function private.usuario_pode_editar_setor(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.usuario_pode_editar_setor(uuid,uuid,text) to service_role;

create or replace function public.fn_venda_estado_atual_v1(p_venda_obra_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_auth_uid uuid:=auth.uid(); v_empresa_id uuid; v_venda public.vendas_obras%rowtype; v_estado jsonb; v_revisao jsonb;
begin
 if v_auth_uid is null then raise exception 'Usuário não autenticado'; end if;
 select empresa_id into v_empresa_id from public.usuarios where id=v_auth_uid;
 if v_empresa_id is null then raise exception 'Usuário sem empresa vinculada'; end if;
 if not private.usuario_pode_editar_setor(v_auth_uid,v_empresa_id,'orcamentos') then raise exception 'Usuário sem permissão de edição em Orçamentos'; end if;
 select * into v_venda from public.vendas_obras where id=p_venda_obra_id and empresa_id=v_empresa_id;
 if not found then return null; end if;
 v_estado:=jsonb_build_object('valor_venda',v_venda.valor_venda,'custo_previsto',v_venda.custo_previsto,'itens_snapshot',coalesce(v_venda.itens_snapshot,'[]'::jsonb),'config_snapshot',coalesce(v_venda.config_snapshot,'{}'::jsonb),'versao',v_venda.versao);
 select r.depois into v_revisao from public.venda_obra_revisoes r where r.venda_obra_id=p_venda_obra_id and r.empresa_id=v_empresa_id order by r.versao desc,r.created_at desc limit 1;
 return coalesce(v_revisao,v_estado);
end; $$;

create or replace function public.fn_registrar_revisao_venda_v1(p_venda_obra_id uuid,p_justificativa text,p_depois jsonb,p_impacto_valor numeric default null,p_impacto_custo numeric default null,p_usuario_id uuid default null,p_usuario_nome text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_auth_uid uuid:=auth.uid(); v_empresa_id uuid; v_venda public.vendas_obras%rowtype; v_antes jsonb; v_depois jsonb; v_versao integer; v_id uuid; v_projeto_conferido boolean;
begin
 if v_auth_uid is null or p_usuario_id is distinct from v_auth_uid then raise exception 'Usuário autenticado inválido para revisão de venda'; end if;
 select empresa_id into v_empresa_id from public.usuarios where id=v_auth_uid;
 if v_empresa_id is null then raise exception 'Usuário sem empresa vinculada'; end if;
 if not private.usuario_pode_editar_setor(v_auth_uid,v_empresa_id,'orcamentos') then raise exception 'Usuário sem permissão de edição em Orçamentos'; end if;
 if length(trim(coalesce(p_justificativa,'')))<3 then raise exception 'Justificativa obrigatória para alteração pós-venda'; end if;
 if p_depois is null or jsonb_typeof(p_depois)<>'object' then raise exception 'Estado revisado inválido'; end if;
 select * into v_venda from public.vendas_obras where id=p_venda_obra_id and empresa_id=v_empresa_id for update;
 if not found then raise exception 'Venda não encontrada'; end if;
 v_antes:=public.fn_venda_estado_atual_v1(p_venda_obra_id);
 select coalesce(max(versao),v_venda.versao)+1 into v_versao from public.venda_obra_revisoes where venda_obra_id=p_venda_obra_id and empresa_id=v_empresa_id;
 v_depois:=p_depois||jsonb_build_object('versao',v_versao);
 insert into public.venda_obra_revisoes(empresa_id,venda_obra_id,versao,tipo,justificativa,antes,depois,impacto_valor,impacto_custo,criado_por_id,criado_por_nome) values(v_empresa_id,p_venda_obra_id,v_versao,'ajuste',p_justificativa,v_antes,v_depois,p_impacto_valor,p_impacto_custo,v_auth_uid,p_usuario_nome) returning id into v_id;
 update public.vendas_obras set versao=v_versao,updated_at=now() where id=p_venda_obra_id and empresa_id=v_empresa_id;
 select exists(select 1 from public.setor_kanban_itens ski join public.setor_kanban_colunas c on c.id=ski.coluna_id and c.empresa_id=v_empresa_id where ski.orcamento_id=v_venda.orcamento_id and ski.empresa_id=v_empresa_id and c.setor_id='engenharia-projeto' and lower(c.nome)='projeto conferido') into v_projeto_conferido;
 if v_projeto_conferido then perform public.fn_criar_ordens_producao_v1(v_venda.orcamento_id,v_auth_uid,p_usuario_nome); end if;
 return v_id;
end; $$;

create or replace function public.fn_iniciar_fluxo_venda_v2(p_orcamento_id uuid,p_usuario_id uuid default null,p_usuario_nome text default null) returns table(venda_id uuid,projeto_card_id uuid,conta_id uuid) language plpgsql security definer set search_path='' as $$
declare v_auth_uid uuid:=auth.uid(); v_empresa_id uuid; v_orc public.orcamentos%rowtype; v_venda_id uuid; v_projeto_id uuid; v_conta_id uuid; v_coluna_vendido_id uuid; v_financeiro_ativo boolean;
begin
 if v_auth_uid is null or p_usuario_id is distinct from v_auth_uid then raise exception 'Usuário autenticado inválido para confirmar a venda'; end if;
 select empresa_id into v_empresa_id from public.usuarios where id=v_auth_uid;
 if v_empresa_id is null then raise exception 'Usuário sem empresa vinculada'; end if;
 if not private.usuario_pode_editar_setor(v_auth_uid,v_empresa_id,'orcamentos') then raise exception 'Usuário sem permissão de edição em Orçamentos'; end if;
 perform pg_advisory_xact_lock(hashtext(p_orcamento_id::text));
 select * into v_orc from public.orcamentos where id=p_orcamento_id and empresa_id=v_empresa_id for update;
 if not found then raise exception 'Orçamento não encontrado'; end if;
 if v_orc.cliente_id is null then raise exception 'Cliente precisa estar vinculado antes da confirmação da venda'; end if;
 if coalesce(v_orc.modo_entrada,'')='balcao' then raise exception 'Venda Balcão não usa o fluxo operacional de obras'; end if;
 insert into public.vendas_obras(empresa_id,orcamento_id,cliente_id,obra_id,valor_venda,custo_previsto,condicoes_snapshot,forma_pagamento_snapshot,itens_snapshot,confirmado_por_id,confirmado_por_nome) values(v_empresa_id,v_orc.id,v_orc.cliente_id,v_orc.obra_id,coalesce(v_orc.valor_estimado,0),v_orc.custo_estimado,v_orc.condicoes,v_orc.forma_pagamento,coalesce(v_orc.itens,'[]'::jsonb),v_auth_uid,p_usuario_nome) on conflict(orcamento_id) do nothing;
 select id into v_venda_id from public.vendas_obras where orcamento_id=v_orc.id and empresa_id=v_empresa_id;
 select exists(select 1 from public.workflow_automacoes where evento_chave='venda_confirmada' and acao_tipo='financeiro_venda' and ativo=true and empresa_id=v_empresa_id) into v_financeiro_ativo;
 if v_financeiro_ativo then select id into v_conta_id from public.financeiro_contas_receber where orcamento_id=v_orc.id and empresa_id=v_empresa_id and status<>'cancelado' order by created_at limit 1 for update; if v_conta_id is null then insert into public.financeiro_contas_receber(empresa_id,venda_obra_id,cliente_id,cliente_nome,documento,parcela,total_parcelas,data_emissao,vencimento,valor,status,forma,valor_pago,observacoes,criado_por_id,criado_por_nome,obra_id,orcamento_id) values(v_empresa_id,v_venda_id,v_orc.cliente_id,v_orc.cliente_nome,'Venda sob medida'||case when v_orc.numero is not null then ' - Orçamento #'||v_orc.numero else '' end,1,1,current_date,null,coalesce(v_orc.valor_estimado,0),'aberto',v_orc.forma_pagamento,0,'Pré-lançamento criado pela automação Venda confirmada → Financeiro. O Financeiro pode ajustar parcelas e vencimentos mantendo o histórico.',v_auth_uid,p_usuario_nome,v_orc.obra_id,v_orc.id) returning id into v_conta_id; else update public.financeiro_contas_receber set venda_obra_id=coalesce(venda_obra_id,v_venda_id),obra_id=coalesce(obra_id,v_orc.obra_id),updated_at=now() where id=v_conta_id and empresa_id=v_empresa_id; end if; end if;
 perform public.fn_workflow_disparar_evento_v1('venda_confirmada',v_orc.id,v_venda_id::text,v_auth_uid,p_usuario_nome);
 select ski.id into v_projeto_id from public.setor_kanban_itens ski join public.setor_kanban_colunas c on c.id=ski.coluna_id and c.empresa_id=v_empresa_id where c.setor_id='engenharia-projeto' and ski.orcamento_id=v_orc.id and ski.empresa_id=v_empresa_id order by ski.created_at limit 1;
 select id into v_coluna_vendido_id from public.kanban_colunas where coalesce(gera_medicao_final,false)=true and empresa_id=v_empresa_id order by ordem limit 1;
 update public.orcamentos set status='vendido',coluna_id=coalesce(v_coluna_vendido_id,coluna_id),coluna_atualizada_em=case when v_coluna_vendido_id is not null then now() else coluna_atualizada_em end,updated_at=now() where id=v_orc.id and empresa_id=v_empresa_id;
 if v_orc.obra_id is not null then update public.obras set status='engenharia',updated_at=now() where id=v_orc.obra_id and empresa_id=v_empresa_id; end if;
 return query select v_venda_id,v_projeto_id,v_conta_id;
end; $$;

revoke execute on function public.fn_venda_estado_atual_v1(uuid) from public,anon;
revoke execute on function public.fn_registrar_revisao_venda_v1(uuid,text,jsonb,numeric,numeric,uuid,text) from public,anon;
revoke execute on function public.fn_iniciar_fluxo_venda_v2(uuid,uuid,text) from public,anon;
grant execute on function public.fn_venda_estado_atual_v1(uuid) to authenticated;
grant execute on function public.fn_registrar_revisao_venda_v1(uuid,text,jsonb,numeric,numeric,uuid,text) to authenticated;
grant execute on function public.fn_iniciar_fluxo_venda_v2(uuid,uuid,text) to authenticated;