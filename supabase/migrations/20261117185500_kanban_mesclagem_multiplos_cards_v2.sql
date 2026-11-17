-- Mesclagem cumulativa de 2, 3 ou mais cards, sem alterar preço/itens/W.Vetro do destino.
-- Preserva íntegros os cards retirados e todos os seus campos em snapshots auditáveis.
begin;
CREATE OR REPLACE FUNCTION public.kanban_mesclar_cards_comerciais_v1(p_empresa uuid, p_usuario uuid, p_origem uuid, p_destino uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_origem public.orcamentos%rowtype;
  v_destino public.orcamentos%rowtype;
  v_nome_origem text;
  v_nome_destino text;
  v_fontes jsonb;
  v_fontes_origem jsonb;
  v_anexos jsonb;
  v_midias jsonb;
  v_item jsonb;
  v_anexo jsonb;
  v_url text;
  v_texto text;
  v_entrada jsonb;
  v_usuario_nome text;
  v_contagem_historico integer := 0;
  v_origens jsonb;
  v_origem_integrada jsonb;
  v_fotos text[];
  v_descricao text;
  v_observacoes text;
begin
  if p_origem is null or p_destino is null or p_origem = p_destino then
    raise exception 'Selecione dois cards diferentes.';
  end if;
  select nome into v_usuario_nome from public.usuarios u
   where u.id = p_usuario and u.empresa_id = p_empresa
     and (
       lower(u.role) = 'master'
       or exists (
         select 1 from public.permissoes p
         where p.usuario_id = u.id and p.empresa_id = u.empresa_id
           and p.setor_id in ('fazer-orcamento-msanfyvj', 'orcamentos')
           and p.nivel = 'edicao'
       )
     );
  if v_usuario_nome is null then
    raise exception 'Usuário sem permissão de edição comercial para unir cards.';
  end if;

  -- Bloqueia ambos em ordem estável. Tudo ocorre na mesma transação.
  perform id from public.orcamentos
   where empresa_id = p_empresa and id in (p_origem, p_destino)
   order by id for update;

  select * into v_origem from public.orcamentos
   where empresa_id = p_empresa and id = p_origem;
  select * into v_destino from public.orcamentos
   where empresa_id = p_empresa and id = p_destino;
  if v_origem.id is null or v_destino.id is null then
    raise exception 'Card de origem ou destino não encontrado na empresa.';
  end if;
  if v_origem.kanban_retirado_em is not null or v_destino.kanban_retirado_em is not null then
    raise exception 'Não é possível mesclar card já retirado.';
  end if;
  v_nome_origem := translate(upper(regexp_replace(btrim(coalesce(v_origem.cliente_nome,'')), '[[:space:]]+', ' ', 'g')),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC');
  v_nome_destino := translate(upper(regexp_replace(btrim(coalesce(v_destino.cliente_nome,'')), '[[:space:]]+', ' ', 'g')),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC');
  if length(v_nome_origem) < 3 or (
       v_nome_origem <> v_nome_destino
       and not (v_origem.cliente_id is not null
         and v_destino.cliente_id is not null
         and v_origem.cliente_id = v_destino.cliente_id)
     ) then
    raise exception 'Os nomes ou cadastros dos clientes são diferentes. Verifique antes de unir os cards.';
  end if;
  if v_origem.cliente_id is not null and v_destino.cliente_id is not null
     and v_origem.cliente_id <> v_destino.cliente_id then
    raise exception 'Os cards pertencem a cadastros diferentes. Corrija a identidade antes de unir.';
  end if;
  if v_origem.status in ('aprovado','convertido')
     or v_origem.orcamento_finalizado_em is not null or v_origem.eh_assistencia = true
     or v_origem.assistencia_id is not null
     or coalesce(nullif(v_origem.wvetro_fluxo->>'numero',''),nullif(v_origem.wvetro_fluxo->>'numero_wvetro',''),'') <> ''
     or exists (select 1 from public.vendas_obras where empresa_id = p_empresa and orcamento_id = p_origem)
     or exists (select 1 from public.financeiro_contas_receber where empresa_id = p_empresa and orcamento_id = p_origem)
     or exists (select 1 from public.ordens_producao where empresa_id = p_empresa and orcamento_id = p_origem)
  then
    raise exception 'O card arrastado possui vínculo financeiro, técnico ou W.Vetro; não pode ser incorporado automaticamente.';
  end if;

  -- Itens técnicos e preços do destino NUNCA são alterados.
  v_fontes := case when jsonb_typeof(v_destino.ia_fontes)='object' then v_destino.ia_fontes else '{}'::jsonb end;
  v_fontes_origem := case when jsonb_typeof(v_origem.ia_fontes)='object' then v_origem.ia_fontes else '{}'::jsonb end;
  v_anexos := case when jsonb_typeof(v_destino.anexos)='array' then v_destino.anexos else '[]'::jsonb end;
  v_fotos := coalesce(v_destino.fotos_urls, array[]::text[]);
  -- Fotos de cada origem integram a galeria principal; o W.Vetro permanece intocado.
  for v_url in select unnest(coalesce(v_origem.fotos_urls, array[]::text[])) loop
    if nullif(btrim(v_url),'') is not null and not (v_url = any(v_fotos)) then
      v_fotos := array_append(v_fotos, v_url);
    end if;
  end loop;
  if nullif(btrim(coalesce(v_origem.anexo_url,'')),'') is not null
    and not exists (select 1 from jsonb_array_elements(v_anexos) a where a.value->>'url'=v_origem.anexo_url) then
    v_anexos := v_anexos || jsonb_build_array(jsonb_build_object(
      'url',v_origem.anexo_url,'nome',coalesce(nullif(v_origem.anexo_nome,''),'Arquivo do card incorporado'),
      'titulo',coalesce(nullif(v_origem.anexo_nome,''),'Arquivo do card incorporado')
    ));
  end if;
  v_midias := case when jsonb_typeof(v_fontes->'anexos')='array' then v_fontes->'anexos' else '[]'::jsonb end;

  for v_anexo in select value from jsonb_array_elements(
    case when jsonb_typeof(v_origem.anexos)='array' then v_origem.anexos else '[]'::jsonb end
  ) loop
    if not exists (select 1 from jsonb_array_elements(v_anexos) a
      where (coalesce(a.value->>'url','') <> '' and a.value->>'url' = v_anexo->>'url')
        or a.value = v_anexo) then
      v_anexos := v_anexos || jsonb_build_array(v_anexo);
    end if;
  end loop;
  for v_anexo in select value from jsonb_array_elements(
    case when jsonb_typeof(v_fontes_origem->'anexos')='array' then v_fontes_origem->'anexos' else '[]'::jsonb end
  ) loop
    if not exists (select 1 from jsonb_array_elements(v_midias) a
      where (a.value->>'media_path' = v_anexo->>'media_path'
        and coalesce(a.value->>'media_path','') <> '')
        or (a.value->>'mensagem_id' = v_anexo->>'mensagem_id'
          and coalesce(a.value->>'mensagem_id','') <> '')
        or a.value = v_anexo) then
      v_midias := v_midias || jsonb_build_array(v_anexo);
    end if;
  end loop;

  -- Fotos anexadas aos itens do card de origem ficam como anexos comuns:
  -- não misturamos os itens extraídos por IA à lista técnica W.Vetro.
  for v_url in
    select distinct url from (
      select unnest(coalesce(v_origem.fotos_urls, array[]::text[])) as url
      union all
      select e.value->>'foto_url' from jsonb_array_elements(
        case when jsonb_typeof(v_origem.itens)='array' then v_origem.itens else '[]'::jsonb end) e
      union all
      select e.value->>'foto_larguras_url' from jsonb_array_elements(
        case when jsonb_typeof(v_origem.itens)='array' then v_origem.itens else '[]'::jsonb end) e
      union all
      select e.value->>'foto_alturas_url' from jsonb_array_elements(
        case when jsonb_typeof(v_origem.itens)='array' then v_origem.itens else '[]'::jsonb end) e
      union all
      select jsonb_array_elements_text(
        case when jsonb_typeof(e.value->'foto_urls')='array' then e.value->'foto_urls' else '[]'::jsonb end)
      from jsonb_array_elements(
        case when jsonb_typeof(v_origem.itens)='array' then v_origem.itens else '[]'::jsonb end) e
    ) fotos where url like 'https://%'
  loop
    if not exists (select 1 from jsonb_array_elements(v_anexos) a where a.value->>'url'=v_url) then
      v_anexos := v_anexos || jsonb_build_array(jsonb_build_object(
        'titulo','Foto do card incorporado','nome','Foto de '||v_origem.cliente_nome,'url',v_url
      ));
    end if;
  end loop;

  -- Fotos de medições de trena também ficam disponíveis como anexos no principal.
  for v_url in
    select distinct url from (
      select e.value->>'foto_url' as url from jsonb_array_elements(
        case when jsonb_typeof(v_origem.medidas_trena)='array' then v_origem.medidas_trena else '[]'::jsonb end) e
    ) fotos where nullif(btrim(url),'') is not null
  loop
    if not exists (select 1 from jsonb_array_elements(v_anexos) a where a.value->>'url'=v_url) then
      v_anexos := v_anexos || jsonb_build_array(jsonb_build_object(
        'titulo','Foto de medida incorporada','nome','Foto da trena · '||v_origem.cliente_nome,'url',v_url
      ));
    end if;
  end loop;

  -- Juntar conteúdo textual no card principal, sem substituir o texto original.
  v_descricao := btrim(coalesce(v_destino.descricao_livre,''));
  v_observacoes := btrim(coalesce(v_destino.observacoes,''));
  if nullif(btrim(coalesce(v_origem.descricao_livre,'')),'') is not null then
    v_descricao := concat_ws(E'\n\n', nullif(v_descricao,''),
      '[Card incorporado '||p_origem::text||'] '||btrim(v_origem.descricao_livre));
  end if;
  if nullif(btrim(coalesce(v_origem.observacoes,'')),'') is not null then
    v_observacoes := concat_ws(E'\n\n', nullif(v_observacoes,''),
      '[Card incorporado '||p_origem::text||'] '||btrim(v_origem.observacoes));
  end if;
  v_texto := btrim(coalesce(v_fontes->>'conteudo_bruto',''));
  if btrim(coalesce(v_fontes_origem->>'conteudo_bruto',v_origem.descricao_livre,'')) <> '' then
    v_texto := concat_ws(E'\n\n', nullif(v_texto,''),
      '[Card incorporado '||p_origem::text||'] '||
      btrim(coalesce(v_fontes_origem->>'conteudo_bruto',v_origem.descricao_livre,'')));
  end if;
  v_entrada := jsonb_build_object(
    'id',p_origem, 'cliente_nome',v_origem.cliente_nome,
    'modo_entrada',v_origem.modo_entrada, 'criado_em',v_origem.created_at,
    'descricao',v_origem.descricao_livre, 'observacoes',v_origem.observacoes,
    'itens',coalesce(v_origem.itens,'[]'::jsonb),
    'fontes',v_fontes_origem,
    -- Registro completo do card arrastado, incluindo campos técnicos e comerciais:
    -- dados históricos consultáveis, NÃO adicionados aos itens/valores W.Vetro de destino.
    'dados',to_jsonb(v_origem)
  );
  -- Mesclagem cumulativa: se o card arrastado já agregou outros, incorporar
  -- cada origem anterior individualmente, sem perder, duplicar nem esconder históricos.
  v_origens := case when jsonb_typeof(v_fontes->'origem_cards')='array'
    then v_fontes->'origem_cards' else '[]'::jsonb end;
  for v_origem_integrada in select value from jsonb_array_elements(
    case when jsonb_typeof(v_fontes_origem->'origem_cards')='array'
      then v_fontes_origem->'origem_cards' else '[]'::jsonb end
  ) loop
    if nullif(v_origem_integrada->>'id','') is not null
      and v_origem_integrada->>'id' <> p_destino::text
      and not exists (select 1 from jsonb_array_elements(v_origens) x
        where x.value->>'id' = v_origem_integrada->>'id') then
      v_origens := v_origens || jsonb_build_array(v_origem_integrada);
    end if;
  end loop;
  if not exists (select 1 from jsonb_array_elements(v_origens) x where x.value->>'id'=p_origem::text) then
    v_origens := v_origens || jsonb_build_array(v_entrada);
  end if;
  v_fontes := v_fontes || jsonb_build_object(
    'conteudo_bruto',v_texto,
    'anexos',v_midias,
    'origem_cards',v_origens
  );

  update public.orcamentos set anexos=v_anexos, fotos_urls=v_fotos,
    descricao_livre=nullif(v_descricao,''), observacoes=nullif(v_observacoes,''),
    ia_fontes=v_fontes, updated_at=now()
   where id=p_destino and empresa_id=p_empresa;
  update public.tarefas set orcamento_id=p_destino
   where empresa_id=p_empresa and orcamento_id=p_origem;
  update public.atendimento_whatsapp_intakes set orcamento_id=p_destino
   where empresa_id=p_empresa and orcamento_id=p_origem;
  insert into public.historico (empresa_id,orcamento_id,usuario_id,usuario_nome,acao,detalhes,created_at)
    select p_empresa,p_destino,h.usuario_id,h.usuario_nome,
      'Card incorporado: '||h.acao,
      'Origem '||p_origem::text||' · '||coalesce(h.detalhes,''),h.created_at
    from public.historico h
    where h.empresa_id=p_empresa and h.orcamento_id=p_origem;
  get diagnostics v_contagem_historico = row_count;
  insert into public.historico (empresa_id,orcamento_id,usuario_id,usuario_nome,acao,detalhes)
   values (p_empresa,p_destino,p_usuario,v_usuario_nome,'Uniu cards no Kanban Comercial',
     'Origem '||p_origem::text||' incorporada em '||p_destino::text||
     ' · anexos, notas, mídias e histórico preservados. W.Vetro, itens técnicos e valores inalterados.');
  update public.orcamentos set kanban_retirado_em=now(),
    kanban_retirado_por_id=p_usuario,
    kanban_retirado_motivo='Card mesclado com '||p_destino::text||' no Kanban Comercial',
    updated_at=now()
   where empresa_id=p_empresa and id=p_origem;
  insert into public.kanban_comercial_cards_auditoria
    (empresa_id,orcamento_id,acao,motivo,usuario_id,cliente_nome)
  values (p_empresa,p_origem,'retirar','Card mesclado com '||p_destino::text,
    p_usuario,coalesce(v_origem.cliente_nome,''));
  return jsonb_build_object('ok',true,'origemId',p_origem,'destinoId',p_destino,
    'historicosCopiados',v_contagem_historico);
end;$function$;

revoke all on function public.kanban_mesclar_cards_comerciais_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.kanban_mesclar_cards_comerciais_v1(uuid,uuid,uuid,uuid) to service_role;
commit;
