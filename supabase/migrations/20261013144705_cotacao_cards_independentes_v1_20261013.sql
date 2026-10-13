-- Mantém a identidade de cada card de compra ao cruzar etapas do Kanban.
-- Uma movimentação parcial cria um grupo novo; mover o grupo inteiro preserva o ID.
-- Dados legados sem grupo_card_id continuam legíveis, sem reescrever a cotação.
create or replace function public.fn_mover_itens_lote_cotacao_v1(
  p_empresa uuid, p_lote uuid, p_venda uuid, p_versao integer,
  p_origem text, p_destino text, p_material_ids uuid[],
  p_usuario uuid, p_nome text, p_motivo text default null
)
returns table (id uuid, status text, versao integer, itens jsonb)
language plpgsql security definer set search_path='public'
as $$
declare
  v record;
  v_item jsonb;
  v_novo jsonb := '[]'::jsonb;
  v_material_id uuid;
  v_etapa text;
  v_status text;
  v_alterados integer := 0;
  v_total integer;
  v_grupo_origem text;
  v_grupo_destino text;
  v_grupos_selecionados integer;
  v_itens_no_grupo integer;
begin
  if p_origem not in ('necessidade','cotacao','comprado','entrega','recebido')
     or p_destino not in ('necessidade','cotacao','comprado','entrega','recebido')
     or p_origem=p_destino then
    raise exception 'Etapas de origem/destino inválidas';
  end if;
  v_total := cardinality(p_material_ids);
  if p_material_ids is null or v_total < 1 or v_total > 1000
    or (select count(distinct x) from unnest(p_material_ids) x)<>v_total
    or array_position(p_material_ids,null) is not null then
    raise exception 'Seleção de materiais inválida';
  end if;
  select l.id,l.status,l.versao,l.itens into v
    from public.venda_cotacao_lotes l
    where l.id=p_lote and l.empresa_id=p_empresa and l.venda_obra_id=p_venda
    for update;
  if not found then raise exception 'Cotação não encontrada nesta empresa'; end if;
  if v.versao<>p_versao then raise exception 'Card alterado por outro usuário; atualize e tente novamente'; end if;
  if v.status='cancelado' then raise exception 'Cotação cancelada'; end if;
  if jsonb_typeof(v.itens)<>'array' then raise exception 'Itens da cotação inválidos'; end if;

  -- Não é permitido juntar duas compras independentes numa única movimentação.
  select count(distinct coalesce(nullif(x.value->>'grupo_card_id',''),'legado')),
         min(coalesce(nullif(x.value->>'grupo_card_id',''),'legado'))
    into v_grupos_selecionados,v_grupo_origem
    from jsonb_array_elements(v.itens) x
    where (x.value->>'material_id')::uuid=any(p_material_ids);
  if v_grupos_selecionados<>1 then
    raise exception 'Selecione somente um card de compra por movimentação';
  end if;
  select count(*) into v_itens_no_grupo
    from jsonb_array_elements(v.itens) x
    where coalesce(nullif(x.value->>'grupo_card_id',''),'legado')=v_grupo_origem;

  -- Card legado recebe identidade na primeira movimentação; um subconjunto
  -- de um card já identificado recebe outra identidade para nunca se fundir.
  if v_grupo_origem='legado' or v_itens_no_grupo>v_total then
    v_grupo_destino:=gen_random_uuid()::text;
  else
    v_grupo_destino:=v_grupo_origem;
  end if;

  for v_item in select value from jsonb_array_elements(v.itens) loop
    v_material_id := nullif(v_item->>'material_id','')::uuid;
    v_etapa := coalesce(nullif(v_item->>'status_etapa',''),v.status);
    if v_material_id=any(p_material_ids) then
      if v_etapa<>p_origem then raise exception 'O material % não está na etapa selecionada',v_material_id; end if;
      v_item := jsonb_set(v_item,'{status_etapa}',to_jsonb(p_destino),true);
      v_item := jsonb_set(v_item,'{grupo_card_id}',to_jsonb(v_grupo_destino),true);
      v_alterados := v_alterados+1;
    else
      -- Material não selecionado conserva a etapa anterior, mesmo se a etapa
      -- resumida do lote for alterada por uma movimentação parcial.
      v_item := jsonb_set(v_item,'{status_etapa}',to_jsonb(v_etapa),true);
    end if;
    v_novo := v_novo || jsonb_build_array(v_item);
  end loop;
  if v_alterados<>v_total then
    raise exception 'A seleção contém material não encontrado ou duplicado nesta cotação';
  end if;
  -- Campo legado resume o lote pela etapa mais atrasada. As etapas reais são
  -- aquelas armazenadas em cada item e exibidas pelos cards segmentados.
  select x.value->>'status_etapa' into v_status from jsonb_array_elements(v_novo) x
    order by case x.value->>'status_etapa'
      when 'necessidade' then 1 when 'cotacao' then 2
      when 'comprado' then 3 when 'entrega' then 4 when 'recebido' then 5 else 6 end limit 1;
  update public.venda_cotacao_lotes l set
    itens=v_novo,status=coalesce(v_status,p_destino),
    versao=v.versao+1,updated_at=now()
    where l.id=p_lote and l.empresa_id=p_empresa;
  insert into public.venda_cotacao_movimentacoes
    (empresa_id,lote_id,status_anterior,status_novo,versao_anterior,versao_nova,
     motivo,usuario_id,usuario_nome,material_ids,quantidade_itens)
    values(p_empresa,p_lote,p_origem,p_destino,v.versao,v.versao+1,
      left(p_motivo,1000),p_usuario,left(p_nome,200),p_material_ids,v_total);
  return query select p_lote,coalesce(v_status,p_destino),(v.versao+1)::integer,v_novo;
end;
$$;
revoke all on function public.fn_mover_itens_lote_cotacao_v1(uuid,uuid,uuid,integer,text,text,uuid[],uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.fn_mover_itens_lote_cotacao_v1(uuid,uuid,uuid,integer,text,text,uuid[],uuid,text,text)
  to service_role;
