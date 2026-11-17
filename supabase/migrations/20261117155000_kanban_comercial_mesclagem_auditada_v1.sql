-- Mesclagem manual auditável, sem alterar itens/valores/validação do W.Vetro.
-- Executada exclusivamente pela API autenticada com service_role.
begin;

create or replace function public.kanban_mesclar_cards_comerciais_v1(
  p_empresa uuid, p_usuario uuid, p_origem uuid, p_destino uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
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
begin
  if p_origem is null or p_destino is null or p_origem = p_destino then
    raise exception 'Selecione dois cards diferentes.';
  end if;
  select nome into v_usuario_nome from public.usuarios
   where id = p_usuario and empresa_id = p_empresa and lower(role) = 'master';
  if v_usuario_nome is null then
    raise exception 'Somente o Master pode reunir cards e arquivar o duplicado.';
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
  if length(v_nome_origem) < 3 or v_nome_origem <> v_nome_destino then
    raise exception 'Os nomes dos clientes são diferentes. Verifique antes de unir os cards.';
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
  v_midias := case when jsonb_typeof(v_fontes->'anexos')='array' then v_fontes->'anexos' else '[]'::jsonb end;

  for v_anexo in select value from jsonb_array_elements(
    case when jsonb_typeof(v_origem.anexos)='array' then v_origem.anexos else '[]'::jsonb end
  ) loop
    if not exists (select 1 from jsonb_array_elements(v_anexos) a
      where coalesce(a.value->>'url','') <> '' and a.value->>'url' = v_anexo->>'url') then
      v_anexos := v_anexos || jsonb_build_array(v_anexo);
    end if;
  end loop;
  for v_anexo in select value from jsonb_array_elements(
    case when jsonb_typeof(v_fontes_origem->'anexos')='array' then v_fontes_origem->'anexos' else '[]'::jsonb end
  ) loop
    if not exists (select 1 from jsonb_array_elements(v_midias) a
      where a.value->>'media_path' = v_anexo->>'media_path'
        and coalesce(a.value->>'media_path','') <> '') then
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
    'fontes',v_fontes_origem
  );
  v_fontes := v_fontes || jsonb_build_object(
    'conteudo_bruto',v_texto,
    'anexos',v_midias,
    'origem_cards',coalesce(v_fontes->'origem_cards','[]'::jsonb)||jsonb_build_array(v_entrada)
  );

  update public.orcamentos set anexos=v_anexos, ia_fontes=v_fontes, updated_at=now()
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
end;$$;

revoke all on function public.kanban_mesclar_cards_comerciais_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.kanban_mesclar_cards_comerciais_v1(uuid,uuid,uuid,uuid) to service_role;
commit;
