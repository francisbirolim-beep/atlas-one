begin;
create temp table _p0_hist_result(resultado text) on commit drop;
do $$
declare
  v_id uuid;
  v_empresa uuid;
  v_val numeric;
  v_hist_empresa uuid;
  v_hist_versao integer;
  v_bloqueou boolean:=false;
begin
  select id,empresa_id,valor into v_id,v_empresa,v_val
  from public.configuracoes_precificacao order by id limit 1;

  update public.configuracoes_precificacao set valor=v_val+0.01 where id=v_id;

  select empresa_id,versao into v_hist_empresa,v_hist_versao
  from public.cadastro_historico
  where entidade_tabela='configuracoes_precificacao' and entidade_id=v_id
  order by created_at desc limit 1;

  if v_hist_empresa is distinct from v_empresa then
    raise exception 'historico sem tenant correto';
  end if;
  if v_hist_versao < 2 then
    raise exception 'versionamento invalido: %',v_hist_versao;
  end if;

  begin
    insert into public.cadastro_historico(entidade_tabela,entidade_tipo,entidade_id,versao,acao,origem)
    values('produtos','produto',gen_random_uuid(),999999,'alterado','teste_p0');
  exception when check_violation then
    v_bloqueou:=true;
  end;

  if not v_bloqueou then
    raise exception 'constraint nao bloqueou historico tenant sem empresa';
  end if;

  insert into _p0_hist_result values('P0_CADASTRO_HISTORICO_TENANT_OK');
end $$;
select * from _p0_hist_result;
rollback;
