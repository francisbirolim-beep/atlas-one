begin;

create or replace function private.usuario_pode_administrar_base_tecnica_global(p_usuario_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.usuarios u
    join public.empresas e on e.id=u.empresa_id
    where u.id=p_usuario_id
      and u.role='master'
      and e.ativo=true
      and e.slug='esquadrifacio'
  );
$$;
revoke all on function private.usuario_pode_administrar_base_tecnica_global(uuid) from public,anon,authenticated;
grant execute on function private.usuario_pode_administrar_base_tecnica_global(uuid) to service_role;

create or replace function public.fn_duplicar_tipologia_v1(
  p_tipologia_id uuid,
  p_novo_label text,
  p_nova_chave text default null,
  p_justificativa text default 'Duplicação técnica'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid(); v_nome text; v_src public.tipologias%rowtype; v_nova_id uuid; v_chave text;
  v_receita public.engenharia_receitas%rowtype; v_nova_receita_id uuid;
begin
  if not private.usuario_pode_administrar_base_tecnica_global(v_uid) then raise exception 'Base técnica global restrita ao administrador autorizado'; end if;
  select nome into v_nome from public.usuarios where id=v_uid;
  if length(trim(coalesce(p_novo_label,'')))<2 then raise exception 'Informe o nome da nova tipologia'; end if;
  if length(trim(coalesce(p_justificativa,'')))<3 then raise exception 'Justificativa obrigatória'; end if;
  select * into v_src from public.tipologias where id=p_tipologia_id;
  if not found then raise exception 'Tipologia não encontrada'; end if;
  v_chave:=coalesce(nullif(trim(p_nova_chave),''),v_src.chave||'-copia-'||substr(replace(gen_random_uuid()::text,'-',''),1,6));
  if exists(select 1 from public.tipologias where chave=v_chave) then raise exception 'Já existe tipologia com esta chave'; end if;

  insert into public.tipologias(chave,label,categoria,ordem,ativo,origem_referencia,linha_origem_wvetro,modelo_origem_wvetro,foto_url,versao_tecnica)
  values(v_chave,trim(p_novo_label),v_src.categoria,v_src.ordem+1,true,'atlas',v_src.linha_origem_wvetro,v_src.modelo_origem_wvetro,v_src.foto_url,1)
  returning id into v_nova_id;

  insert into public.linha_tipologias(linha_id,tipologia_id)
  select linha_id,v_nova_id from public.linha_tipologias where tipologia_id=p_tipologia_id on conflict do nothing;

  insert into public.engenharia_tipologia_variaveis(tipologia_id,variavel_id,ordem,obrigatorio)
  select v_nova_id,variavel_id,ordem,obrigatorio from public.engenharia_tipologia_variaveis where tipologia_id=p_tipologia_id;

  insert into public.engenharia_variaveis_preset(tipologia_id,produto_id,nome,valores,padrao,criado_por_id,criado_por_nome,usar_no_orcamento,validado,validado_em,validado_por_id,validado_por_nome,evidencia_validacao,ativo,imagem_url,campos_corte)
  select v_nova_id,produto_id,nome,valores,padrao,v_uid,v_nome,usar_no_orcamento,false,null,null,null,null,ativo,imagem_url,campos_corte
  from public.engenharia_variaveis_preset where tipologia_id=p_tipologia_id;

  insert into public.engenharia_tipologia_formulas_corte(tipologia_id,variaveis,pecas,ativo,criado_por_id,criado_por_nome,configuracao_chave,configuracao_label,status,versao,observacoes,vidro,acessorios)
  select v_nova_id,variaveis,pecas,ativo,v_uid,v_nome,configuracao_chave,configuracao_label,'em_desenvolvimento',1,
         concat_ws(E'\n',observacoes,'Duplicada de '||v_src.label||'. '||trim(p_justificativa)),vidro,acessorios
  from public.engenharia_tipologia_formulas_corte where tipologia_id=p_tipologia_id;

  for v_receita in select * from public.engenharia_receitas where tipologia_id=p_tipologia_id loop
    insert into public.engenharia_receitas(tipologia_id,nome,versao,ativo,observacoes,criado_por_id,criado_por_nome,produto_id)
    values(v_nova_id,v_receita.nome,1,false,concat_ws(E'\n',v_receita.observacoes,'Duplicada de '||v_src.label||'. '||trim(p_justificativa)),v_uid,v_nome,v_receita.produto_id)
    returning id into v_nova_receita_id;
    insert into public.engenharia_receita_componentes(receita_id,tipo,produto_id,nome,unidade,quantidade_base,formula_quantidade,formula_corte,observacao,ordem)
    select v_nova_receita_id,tipo,produto_id,nome,unidade,quantidade_base,formula_quantidade,formula_corte,observacao,ordem
    from public.engenharia_receita_componentes where receita_id=v_receita.id;
  end loop;

  update public.engenharia_tipologia_formulas_historico h
  set evento='duplicacao',justificativa=trim(p_justificativa),criado_por_id=v_uid,criado_por_nome=v_nome
  where h.tipologia_id=v_nova_id and h.versao=1;
  return v_nova_id;
end;
$$;

create or replace function public.fn_restaurar_formula_tipologia_v1(p_formula_id uuid,p_versao integer,p_justificativa text)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid(); v_nome text; v_hist public.engenharia_tipologia_formulas_historico%rowtype;
  v_formula public.engenharia_tipologia_formulas_corte%rowtype; v_nova_versao integer;
begin
  if not private.usuario_pode_administrar_base_tecnica_global(v_uid) then raise exception 'Base técnica global restrita ao administrador autorizado'; end if;
  select nome into v_nome from public.usuarios where id=v_uid;
  if length(trim(coalesce(p_justificativa,'')))<3 then raise exception 'Justificativa obrigatória para restaurar versão'; end if;
  select * into v_hist from public.engenharia_tipologia_formulas_historico where formula_id=p_formula_id and versao=p_versao;
  if not found then raise exception 'Versão histórica não encontrada'; end if;
  select * into v_formula from public.engenharia_tipologia_formulas_corte where id=p_formula_id for update;
  if not found then raise exception 'Fórmula técnica não encontrada'; end if;
  update public.engenharia_tipologia_formulas_corte
  set configuracao_label=coalesce(v_hist.snapshot->>'configuracao_label',configuracao_label),variaveis=coalesce(v_hist.snapshot->'variaveis','[]'::jsonb),
      pecas=coalesce(v_hist.snapshot->'pecas','[]'::jsonb),acessorios=coalesce(v_hist.snapshot->'acessorios','[]'::jsonb),
      vidro=coalesce(v_hist.snapshot->'vidro','{}'::jsonb),status=coalesce(v_hist.snapshot->>'status',status),
      observacoes=v_hist.snapshot->>'observacoes',ativo=coalesce((v_hist.snapshot->>'ativo')::boolean,ativo),versao=v_formula.versao+1
  where id=p_formula_id returning versao into v_nova_versao;
  update public.engenharia_tipologia_formulas_historico
  set evento='restauracao',justificativa=trim(p_justificativa),restaurada_de_versao=p_versao,criado_por_id=v_uid,criado_por_nome=v_nome
  where formula_id=p_formula_id and versao=v_nova_versao;
  return v_nova_versao;
end;
$$;

create or replace function public.fn_tipologia_substituir_componente_direto_v1(
  p_formula_id uuid,p_componente_tipo text,p_codigo_origem text,p_codigo_destino text,p_justificativa text,
  p_orcamento_id uuid default null,p_item_ref text default null
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid(); v_nome text; v_formula public.engenharia_tipologia_formulas_corte%rowtype;
  v_array jsonb; v_novo jsonb; v_encontrados integer; v_nova_versao integer;
begin
  if not private.usuario_pode_administrar_base_tecnica_global(v_uid) then raise exception 'Base técnica global restrita ao administrador autorizado'; end if;
  select nome into v_nome from public.usuarios where id=v_uid;
  if length(trim(coalesce(p_justificativa,'')))<3 then raise exception 'Justificativa obrigatória'; end if;
  if nullif(trim(coalesce(p_codigo_origem,'')),'') is null or nullif(trim(coalesce(p_codigo_destino,'')),'') is null then raise exception 'Informe perfil/acessório de origem e destino'; end if;
  if p_componente_tipo not in ('perfil','acessorio') then raise exception 'Alteração definitiva direta suportada apenas para perfil/acessório; use o editor técnico para este componente'; end if;
  select * into v_formula from public.engenharia_tipologia_formulas_corte where id=p_formula_id for update;
  if not found then raise exception 'Fórmula técnica não encontrada'; end if;
  v_array:=case when p_componente_tipo='perfil' then coalesce(v_formula.pecas,'[]'::jsonb) else coalesce(v_formula.acessorios,'[]'::jsonb) end;
  select count(*) into v_encontrados from jsonb_array_elements(v_array) e where upper(coalesce(e->>'codigo',''))=upper(trim(p_codigo_origem));
  if v_encontrados=0 then
    if v_array::text ilike '%'||p_codigo_origem||'%' then raise exception 'O componente aparece em uma regra técnica complexa. Abra o Editor Técnico para alterar sem quebrar a configuração.'; end if;
    raise exception 'Componente de origem não encontrado na receita';
  end if;
  select coalesce(jsonb_agg(case when upper(coalesce(e->>'codigo',''))=upper(trim(p_codigo_origem)) then jsonb_set(e,'{codigo}',to_jsonb(trim(p_codigo_destino)),true) else e end),'[]'::jsonb)
  into v_novo from jsonb_array_elements(v_array) e;
  if p_componente_tipo='perfil' then
    update public.engenharia_tipologia_formulas_corte set pecas=v_novo where id=p_formula_id returning versao into v_nova_versao;
  else
    update public.engenharia_tipologia_formulas_corte set acessorios=v_novo where id=p_formula_id returning versao into v_nova_versao;
  end if;
  update public.engenharia_tipologia_formulas_historico
  set evento='substituicao_componente',justificativa=trim(p_justificativa),origem_orcamento_id=p_orcamento_id,origem_item_ref=p_item_ref,criado_por_id=v_uid,criado_por_nome=v_nome
  where formula_id=p_formula_id and versao=v_nova_versao;
  return v_nova_versao;
end;
$$;

revoke execute on function public.fn_duplicar_tipologia_v1(uuid,text,text,text) from public,anon;
revoke execute on function public.fn_restaurar_formula_tipologia_v1(uuid,integer,text) from public,anon;
revoke execute on function public.fn_tipologia_substituir_componente_direto_v1(uuid,text,text,text,text,uuid,text) from public,anon;
grant execute on function public.fn_duplicar_tipologia_v1(uuid,text,text,text) to authenticated;
grant execute on function public.fn_restaurar_formula_tipologia_v1(uuid,integer,text) to authenticated;
grant execute on function public.fn_tipologia_substituir_componente_direto_v1(uuid,text,text,text,text,uuid,text) to authenticated;

commit;