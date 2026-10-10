create or replace function public.fn_workflow_executar_automacao_v1(
  p_automacao_id uuid,
  p_orcamento_id uuid,
  p_origem_id text default null,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_a public.workflow_automacoes%rowtype;
  v_orc public.orcamentos%rowtype;
  v_card_id uuid;
  v_tarefa_id uuid;
  v_tarefa_coluna uuid;
  v_texto text;
  v_titulo_tarefa text;
  v_href text;
  v_recipientes uuid[];
  v_destinatario uuid;
  v_resp_nome text;
  v_existente uuid;
begin
  select * into v_a from public.workflow_automacoes where id=p_automacao_id and ativo=true;
  if not found then return null; end if;
  select * into v_orc from public.orcamentos where id=p_orcamento_id;
  if not found then return null; end if;

  if v_a.evitar_duplicidade then
    select destino_card_id into v_existente from public.workflow_execucoes where automacao_id=v_a.id and orcamento_id=p_orcamento_id limit 1;
    if found then return v_existente; end if;
  end if;

  v_texto := public.fn_workflow_renderizar_v1(coalesce(v_a.mensagem_template,v_a.nome),p_orcamento_id,v_a.evento_chave);
  v_titulo_tarefa := public.fn_workflow_renderizar_v1(coalesce(v_a.titulo_tarefa_template,v_a.nome),p_orcamento_id,v_a.evento_chave);
  if v_a.responsavel_usuario_id is not null then select nome into v_resp_nome from public.usuarios where id=v_a.responsavel_usuario_id; end if;

  if v_a.acao_tipo in ('criar_card_setor','financeiro_venda') and v_a.destino_setor_id is not null then
    select ski.id into v_card_id
      from public.setor_kanban_itens ski
      join public.setor_kanban_colunas c on c.id=ski.coluna_id
     where c.setor_id=v_a.destino_setor_id and ski.orcamento_id=p_orcamento_id
     order by ski.created_at asc limit 1;

    if v_card_id is null then
      insert into public.setor_kanban_itens(
        titulo,descricao,coluna_id,criado_por_id,criado_por_nome,orcamento_id,
        cliente_id,obra_id,responsavel_id,responsavel_nome,workflow_automacao_id,
        atualizado_por_id,atualizado_por_nome
      ) values(
        coalesce(v_orc.cliente_nome,'Cliente'),v_texto,v_a.destino_coluna_id,
        p_usuario_id,coalesce(p_usuario_nome,'Automação Atlas'),p_orcamento_id,
        v_orc.cliente_id,v_orc.obra_id,v_a.responsavel_usuario_id,v_resp_nome,v_a.id,
        p_usuario_id,p_usuario_nome
      ) returning id into v_card_id;
    else
      update public.setor_kanban_itens set
        cliente_id=coalesce(cliente_id,v_orc.cliente_id), obra_id=coalesce(obra_id,v_orc.obra_id),
        responsavel_id=coalesce(v_a.responsavel_usuario_id,responsavel_id),
        responsavel_nome=coalesce(v_resp_nome,responsavel_nome),
        workflow_automacao_id=coalesce(workflow_automacao_id,v_a.id), atualizado_em=now()
      where id=v_card_id;
    end if;
  elsif v_a.acao_tipo='mee_pos_medicao' and v_a.destino_setor_id is not null then
    select ski.id into v_card_id
      from public.setor_kanban_itens ski join public.setor_kanban_colunas c on c.id=ski.coluna_id
     where c.setor_id=v_a.destino_setor_id and ski.orcamento_id=p_orcamento_id
     order by ski.created_at asc limit 1;
    if v_card_id is null then return null; end if;
    update public.setor_kanban_itens set responsavel_id=v_a.responsavel_usuario_id,responsavel_nome=v_resp_nome,workflow_automacao_id=v_a.id,atualizado_em=now() where id=v_card_id;
  end if;

  if v_a.criar_tarefa and v_a.responsavel_usuario_id is not null then
    select id into v_tarefa_id from public.tarefas
     where workflow_automacao_id=v_a.id and orcamento_id=p_orcamento_id and usuario_id=v_a.responsavel_usuario_id
     limit 1;
    if v_tarefa_id is null then
      v_tarefa_coluna := public.fn_workflow_coluna_tarefa_v1(v_a.responsavel_usuario_id);
      insert into public.tarefas(
        usuario_id,coluna_id,titulo,descricao,data_hora,solicitante_id,solicitante_nome,atribuida_em,prioridade,
        workflow_automacao_id,orcamento_id,cliente_id,obra_id
      ) values(
        v_a.responsavel_usuario_id,v_tarefa_coluna,v_titulo_tarefa,v_texto,
        case when v_a.prazo_horas is null then null else now() + make_interval(hours=>v_a.prazo_horas) end,
        p_usuario_id,p_usuario_nome,now(),v_a.prioridade_tarefa,
        v_a.id,p_orcamento_id,v_orc.cliente_id,v_orc.obra_id
      ) returning id into v_tarefa_id;
    end if;
  end if;

  if v_a.acao_tipo='financeiro_venda' and v_orc.cliente_id is not null then
    v_href := '/clientes/'||v_orc.cliente_id::text||'/central?aba=financeiro';
  elsif v_a.acao_tipo='criar_medicao_final' then
    v_href := '/producao/medicao-final';
  elsif v_a.destino_setor_id is not null then
    v_href := '/setor/'||v_a.destino_setor_id;
  elsif v_orc.cliente_id is not null then
    v_href := '/clientes/'||v_orc.cliente_id::text||'/central?aba=andamento';
  else
    v_href := '/';
  end if;

  v_recipientes := coalesce(v_a.notificar_usuario_ids,'{}'::uuid[]);
  if v_a.notificar_responsavel and v_a.responsavel_usuario_id is not null and not (v_a.responsavel_usuario_id = any(v_recipientes)) then
    v_recipientes := array_append(v_recipientes,v_a.responsavel_usuario_id);
  end if;

  foreach v_destinatario in array v_recipientes loop
    if v_destinatario is not null then
      if v_a.criar_tarefa
         and v_tarefa_id is not null
         and v_destinatario = v_a.responsavel_usuario_id
         and p_usuario_id is not null
         and p_usuario_id <> v_destinatario then
        continue;
      end if;
      insert into public.notificacoes(usuario_id,categoria,tipo,titulo,mensagem,href,origem_tipo,origem_id,criado_por_id,criado_por_nome)
      values(v_destinatario,'operacao','workflow',v_a.nome,v_texto,v_href,'workflow',v_a.id::text||':'||p_orcamento_id::text,p_usuario_id,p_usuario_nome)
      on conflict (usuario_id,origem_tipo,origem_id) where origem_tipo is not null and origem_id is not null do nothing;
    end if;
  end loop;

  insert into public.workflow_execucoes(automacao_id,evento_chave,orcamento_id,origem_id,destino_card_id,tarefa_id,status,executado_por_id,executado_por_nome)
  values(v_a.id,v_a.evento_chave,p_orcamento_id,p_origem_id,v_card_id,v_tarefa_id,'executado',p_usuario_id,p_usuario_nome)
  on conflict (automacao_id,orcamento_id) where orcamento_id is not null do nothing;

  return v_card_id;
end;
$$;

update public.workflow_automacoes
set titulo_tarefa_template='Nova venda — {cliente} — R$ {valor}', updated_at=now()
where evento_chave='venda_confirmada' and acao_tipo='financeiro_venda';