begin;
select set_config('request.jwt.claim.sub',(select id::text from public.usuarios where role='funcionario' limit 1),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$
declare v_uid uuid:=auth.uid(); v_empresa uuid; v_count int; v_chave text; begin
  select empresa_id into v_empresa from public.usuarios where id=v_uid;
  v_chave:='home_usuario:'||v_uid::text||':p0test';
  begin
    insert into public.configuracoes_gerais(empresa_id,chave,valor,updated_at) values(v_empresa,v_chave,'{}',now());
    raise exception 'Funcionário gravou chave arbitrária';
  exception when insufficient_privilege or check_violation then null; end;

  v_chave:='home_usuario:'||v_uid::text;
  delete from public.configuracoes_gerais where empresa_id=v_empresa and chave=v_chave;
  insert into public.configuracoes_gerais(empresa_id,chave,valor,updated_at) values(v_empresa,v_chave,'{"modulos":[]}',now());
  if not exists(select 1 from public.configuracoes_gerais where empresa_id=v_empresa and chave=v_chave) then raise exception 'Funcionário não gravou própria Home'; end if;

  update public.configuracoes_gerais set valor='P0_FORBIDDEN' where empresa_id=v_empresa and chave='dados_empresa';
  get diagnostics v_count=row_count;
  if v_count<>0 then raise exception 'Funcionário alterou configuração corporativa'; end if;
end $$;
rollback;
select 'P0_CONFIG_GERAIS_WRITE_SCOPE_OK' as resultado;
