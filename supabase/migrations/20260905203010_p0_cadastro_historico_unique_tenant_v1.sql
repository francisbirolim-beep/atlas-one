alter table public.cadastro_historico drop constraint if exists cadastro_historico_entidade_tabela_entidade_id_versao_key;

create unique index if not exists cadastro_historico_tenant_version_uidx
  on public.cadastro_historico(empresa_id, entidade_tabela, entidade_id, versao)
  where empresa_id is not null;

create unique index if not exists cadastro_historico_global_version_uidx
  on public.cadastro_historico(entidade_tabela, entidade_id, versao)
  where empresa_id is null
    and entidade_tabela in ('cores','engenharia_tipologia_variaveis','linhas','linhas_tecnicas','tipologia_campos_extras','tipologias');

create or replace function public.fn_cadastro_historico_append_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_before jsonb; v_after jsonb; v_row jsonb; v_id uuid; v_versao integer;
  v_campos text[] := '{}'; v_acao text; v_motivo text; v_origem text;
  v_usuario_id uuid; v_usuario_nome text; v_tipo text; v_claims jsonb;
  v_empresa_id uuid;
  v_global boolean;
begin
  v_before := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_after := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  v_row := coalesce(v_after, v_before, '{}'::jsonb);
  v_id := nullif(v_row->>'id','')::uuid;
  if v_id is null then return coalesce(new, old); end if;

  v_global := tg_table_name in ('cores','engenharia_tipologia_variaveis','linhas','linhas_tecnicas','tipologia_campos_extras','tipologias');
  v_empresa_id := nullif(v_row->>'empresa_id','')::uuid;
  if not v_global and v_empresa_id is null then
    raise exception 'Cadastro historico exige empresa para tabela tenant-owned %', tg_table_name;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}') into v_campos
    from (
      select key as k from jsonb_object_keys(coalesce(v_before,'{}'::jsonb)) key
      union select key as k from jsonb_object_keys(coalesce(v_after,'{}'::jsonb)) key
    ) s
    where k <> 'updated_at' and (v_before->k) is distinct from (v_after->k);
    if cardinality(v_campos) = 0 then return new; end if;
  elsif tg_op = 'INSERT' then
    select coalesce(array_agg(key order by key), '{}') into v_campos
    from jsonb_object_keys(coalesce(v_after,'{}'::jsonb)) key where key not in ('created_at','updated_at');
  else
    select coalesce(array_agg(key order by key), '{}') into v_campos
    from jsonb_object_keys(coalesce(v_before,'{}'::jsonb)) key where key not in ('created_at','updated_at');
  end if;

  v_acao := case when tg_op='INSERT' then 'criado' when tg_op='DELETE' then 'excluido'
    when coalesce(v_after->>'ativo','true')='false' and coalesce(v_before->>'ativo','true')='true' then 'arquivado'
    else 'alterado' end;

  v_motivo := coalesce(nullif(current_setting('app.audit_reason', true),''), nullif(v_after->>'motivo_alteracao',''), nullif(v_after->>'observacao_validacao',''), nullif(v_after->>'observacoes',''), nullif(v_before->>'observacao_validacao',''));
  v_origem := coalesce(nullif(current_setting('app.audit_origin', true),''), nullif(v_after->>'origem',''), nullif(v_after->>'origem_referencia',''), 'sistema');

  begin v_claims := nullif(current_setting('request.jwt.claims', true),'')::jsonb; exception when others then v_claims := null; end;
  v_usuario_id := coalesce(nullif(v_after->>'atualizado_por_id','')::uuid, nullif(v_after->>'validado_por_id','')::uuid, nullif(v_after->>'criado_por_id','')::uuid, nullif(v_before->>'atualizado_por_id','')::uuid, nullif(v_before->>'validado_por_id','')::uuid, nullif(v_before->>'criado_por_id','')::uuid, auth.uid());
  v_usuario_nome := coalesce(nullif(v_after->>'atualizado_por_nome',''), nullif(v_after->>'validado_por_nome',''), nullif(v_after->>'criado_por_nome',''), nullif(v_before->>'atualizado_por_nome',''), nullif(v_before->>'validado_por_nome',''), nullif(v_before->>'criado_por_nome',''), nullif(v_claims->>'email',''));

  v_tipo := case tg_table_name when 'produtos' then 'produto' when 'fornecedores' then 'fornecedor' when 'tipologias' then 'tipologia' when 'linhas' then 'linha' when 'linhas_tecnicas' then 'linha_tecnica' when 'cores' then 'cor' when 'produto_fornecedores' then 'produto_fornecedor' when 'catalogo_custos_tecnicos' then 'custo_tecnico' when 'produto_imagens' then 'produto_imagem' else tg_table_name end;

  perform pg_advisory_xact_lock(hashtext(tg_table_name || ':' || coalesce(v_empresa_id::text,'global') || ':' || v_id::text));
  if v_empresa_id is null then
    select coalesce(max(versao),0)+1 into v_versao
      from public.cadastro_historico
     where entidade_tabela=tg_table_name and entidade_id=v_id and empresa_id is null;
  else
    select coalesce(max(versao),0)+1 into v_versao
      from public.cadastro_historico
     where entidade_tabela=tg_table_name
       and entidade_id=v_id
       and (
         empresa_id=v_empresa_id
         or (
           empresa_id is null
           and nullif(coalesce(dados_depois->>'empresa_id', dados_antes->>'empresa_id'),'')::uuid=v_empresa_id
         )
       );
  end if;

  insert into public.cadastro_historico(empresa_id,entidade_tabela,entidade_tipo,entidade_id,versao,acao,dados_antes,dados_depois,campos_alterados,motivo,origem,usuario_id,usuario_nome)
  values(v_empresa_id,tg_table_name,v_tipo,v_id,v_versao,v_acao,v_before,v_after,v_campos,v_motivo,v_origem,v_usuario_id,v_usuario_nome);
  return coalesce(new,old);
end; $function$;
