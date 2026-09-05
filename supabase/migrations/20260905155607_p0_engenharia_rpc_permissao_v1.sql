begin;

create or replace function private.usuario_pode_editar_setor(p_usuario_id uuid, p_setor_id text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = p_usuario_id
      and u.empresa_id is not null
      and (
        u.role = 'master'
        or exists (
          select 1
          from public.permissoes p
          where p.usuario_id = u.id
            and p.empresa_id = u.empresa_id
            and p.setor_id = p_setor_id
            and p.nivel = 'edicao'
        )
      )
  );
$$;
revoke all on function private.usuario_pode_editar_setor(uuid,text) from public, anon, authenticated;
grant execute on function private.usuario_pode_editar_setor(uuid,text) to service_role;

create or replace function public.fn_concluir_conferencia_projeto_v1(
  p_card_id uuid,
  p_coluna_id uuid,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_empresa_id uuid;
  v_card public.setor_kanban_itens%rowtype;
  v_destino record;
  v_orc public.orcamentos%rowtype;
  v_medicao_id uuid;
  v_med_coluna_id uuid;
  v_cliente_endereco text; v_cliente_bairro text; v_cliente_cep text;
  v_obra_endereco text; v_obra_bairro text; v_obra_cep text; v_obra_cidade text;
  v_medicao_ativa boolean;
begin
  if v_auth_uid is null or p_usuario_id is distinct from v_auth_uid then raise exception 'Usuário autenticado inválido para concluir a conferência'; end if;
  select empresa_id into v_empresa_id from public.usuarios where id=v_auth_uid;
  if v_empresa_id is null then raise exception 'Usuário sem empresa vinculada'; end if;
  if not private.usuario_pode_editar_setor(v_auth_uid,'engenharia-projeto') then raise exception 'Sem permissão de edição na Engenharia — Projeto'; end if;

  select * into v_card from public.setor_kanban_itens where id=p_card_id and empresa_id=v_empresa_id for update;
  if not found or v_card.orcamento_id is null then raise exception 'Card de projeto inválido'; end if;

  select c.nome,c.setor_id into v_destino from public.setor_kanban_colunas c where c.id=p_coluna_id and c.empresa_id=v_empresa_id;
  if v_destino.setor_id<>'engenharia-projeto' or lower(v_destino.nome)<>'projeto conferido' then raise exception 'Destino inválido para concluir a conferência do projeto'; end if;

  select * into v_orc from public.orcamentos where id=v_card.orcamento_id and empresa_id=v_empresa_id for update;
  if not found then raise exception 'Orçamento da venda não encontrado'; end if;

  update public.setor_kanban_itens set coluna_id=p_coluna_id,atualizado_em=now(),atualizado_por_id=v_auth_uid,atualizado_por_nome=p_usuario_nome where id=p_card_id and empresa_id=v_empresa_id;

  select exists(select 1 from public.workflow_automacoes where evento_chave='projeto_conferido' and acao_tipo='criar_medicao_final' and ativo=true and empresa_id=v_empresa_id) into v_medicao_ativa;

  if v_medicao_ativa then
    select id into v_medicao_id from public.medicoes_finais where orcamento_id=v_orc.id and empresa_id=v_empresa_id order by created_at limit 1 for update;
    if v_medicao_id is null then
      select id into v_med_coluna_id from public.medicao_colunas order by ordem limit 1;
      if v_med_coluna_id is null then insert into public.medicao_colunas(nome,ordem) values('Aguardando medida final',0) returning id into v_med_coluna_id; end if;

      if v_orc.cliente_id is not null then
        select endereco,bairro,cep into v_cliente_endereco,v_cliente_bairro,v_cliente_cep from public.clientes where id=v_orc.cliente_id and empresa_id=v_empresa_id;
      end if;
      if v_orc.obra_id is not null then
        select endereco,bairro,cep,cidade into v_obra_endereco,v_obra_bairro,v_obra_cep,v_obra_cidade from public.obras where id=v_orc.obra_id and empresa_id=v_empresa_id;
      end if;

      insert into public.medicoes_finais(empresa_id,orcamento_id,cliente_id,obra_id,cliente_nome,cliente_whatsapp,endereco,bairro,cep,cidade,coluna_id,coluna_atualizada_em,criado_por_id,criado_por_nome)
      values(v_empresa_id,v_orc.id,v_orc.cliente_id,v_orc.obra_id,v_orc.cliente_nome,v_orc.cliente_whatsapp,
        coalesce(v_obra_endereco,v_cliente_endereco,v_orc.obra_endereco),coalesce(v_obra_bairro,v_cliente_bairro,v_orc.obra_bairro),
        coalesce(v_obra_cep,v_cliente_cep,v_orc.obra_cep),coalesce(v_obra_cidade,v_orc.obra_cidade,v_orc.cidade),
        v_med_coluna_id,now(),v_auth_uid,coalesce(nullif(p_usuario_nome,''),'Engenharia — Projeto')) returning id into v_medicao_id;

      insert into public.medicao_itens(empresa_id,medicao_id,tipo_esquadria,tipo_outro_texto,descricao,quantidade,ordem)
      select v_empresa_id,v_medicao_id,coalesce(nullif(j.item->>'tipo_esquadria',''),'outro'),nullif(j.item->>'tipo_outro_texto',''),
        coalesce(nullif(j.item->>'descricao',''),nullif(j.item->>'ambiente',''),'Item '||j.ord::text),
        case when coalesce(j.item->>'quantidade','')~'^[0-9]+$' then greatest((j.item->>'quantidade')::int,1) else 1 end,(j.ord-1)::int
      from jsonb_array_elements(coalesce(v_orc.itens,'[]'::jsonb)) with ordinality as j(item,ord);
    end if;
  end if;

  perform public.fn_workflow_disparar_evento_v1('projeto_conferido',v_orc.id,coalesce(v_medicao_id::text,p_card_id::text),v_auth_uid,p_usuario_nome);
  if v_orc.obra_id is not null then
    update public.obras set status=case when v_medicao_id is not null then 'medicao' else 'engenharia' end,updated_at=now() where id=v_orc.obra_id and empresa_id=v_empresa_id;
  end if;
  return v_medicao_id;
end;
$$;

create or replace function public.fn_engenharia_liberar_para_producao(
  p_card_id uuid,
  p_coluna_id uuid,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_empresa_id uuid;
  v_card public.setor_kanban_itens%rowtype;
  v_destino_nome text;
  v_medicao_id uuid;
  v_total_itens integer;
  v_total_conferidos integer;
  v_producao_coluna_id uuid;
  v_producao_item_id uuid;
begin
  if v_auth_uid is null or p_usuario_id is distinct from v_auth_uid then raise exception 'Usuário autenticado inválido para liberar produção'; end if;
  select empresa_id into v_empresa_id from public.usuarios where id=v_auth_uid;
  if v_empresa_id is null then raise exception 'Usuário sem empresa vinculada'; end if;
  if not private.usuario_pode_editar_setor(v_auth_uid,'engenharia-projeto') then raise exception 'Sem permissão de edição na Engenharia — Projeto'; end if;

  select * into v_card from public.setor_kanban_itens where id=p_card_id and empresa_id=v_empresa_id for update;
  if not found then raise exception 'Obra da Engenharia nao encontrada'; end if;

  select nome into v_destino_nome from public.setor_kanban_colunas where id=p_coluna_id and empresa_id=v_empresa_id;
  if v_destino_nome is null then raise exception 'Etapa de destino da Engenharia nao encontrada'; end if;

  if lower(v_destino_nome) like '%liberad%produ%' then
    if v_card.orcamento_id is null then raise exception 'Nao foi possivel identificar o orcamento da obra para liberar a Producao'; end if;

    select mf.id into v_medicao_id from public.medicoes_finais mf where mf.orcamento_id=v_card.orcamento_id and mf.status_operacional='aprovado' and mf.empresa_id=v_empresa_id order by mf.aprovado_em desc nulls last limit 1;
    if v_medicao_id is null then raise exception 'Medicao Final aprovada nao encontrada para esta obra'; end if;

    select count(*) into v_total_itens from public.medicao_itens where medicao_id=v_medicao_id and empresa_id=v_empresa_id;
    select count(*) into v_total_conferidos from public.medicao_itens mi join public.engenharia_conferencias ec on ec.medicao_item_id=mi.id and ec.empresa_id=v_empresa_id where mi.medicao_id=v_medicao_id and mi.empresa_id=v_empresa_id and ec.status='conferida';
    if v_total_itens=0 or v_total_conferidos<>v_total_itens then raise exception 'Liberacao bloqueada: todas as pecas precisam estar conferidas pela Engenharia'; end if;

    perform pg_advisory_xact_lock(hashtext(v_card.orcamento_id::text));
    select id into v_producao_coluna_id from public.producao_colunas where empresa_id=v_empresa_id order by ordem asc limit 1;
    if v_producao_coluna_id is null then insert into public.producao_colunas(empresa_id,nome,ordem) values(v_empresa_id,'Medição final',0) returning id into v_producao_coluna_id; end if;

    select id into v_producao_item_id from public.producao_itens where orcamento_id=v_card.orcamento_id and empresa_id=v_empresa_id order by created_at asc limit 1 for update;
    if v_producao_item_id is null then
      insert into public.producao_itens(empresa_id,titulo,descricao,coluna_id,orcamento_id,criado_por_id,criado_por_nome,atualizado_em)
      values(v_empresa_id,v_card.titulo,v_card.descricao,v_producao_coluna_id,v_card.orcamento_id,v_auth_uid,coalesce(nullif(p_usuario_nome,''),'Engenharia'),now());
    else
      update public.producao_itens set titulo=v_card.titulo,descricao=v_card.descricao,atualizado_em=now() where id=v_producao_item_id and empresa_id=v_empresa_id;
    end if;

    update public.setor_kanban_itens set coluna_id=p_coluna_id,atualizado_em=now(),liberado_producao_em=now(),liberado_producao_por_id=v_auth_uid,liberado_producao_por_nome=nullif(p_usuario_nome,'') where id=p_card_id and empresa_id=v_empresa_id;
  else
    update public.setor_kanban_itens set coluna_id=p_coluna_id,atualizado_em=now() where id=p_card_id and empresa_id=v_empresa_id;
  end if;
end;
$$;

revoke execute on function public.fn_concluir_conferencia_projeto_v1(uuid,uuid,uuid,text) from public,anon;
revoke execute on function public.fn_engenharia_liberar_para_producao(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.fn_concluir_conferencia_projeto_v1(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.fn_engenharia_liberar_para_producao(uuid,uuid,uuid,text) to authenticated;

commit;