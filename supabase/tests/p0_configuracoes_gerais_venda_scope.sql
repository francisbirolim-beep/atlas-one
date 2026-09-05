begin;
select set_config('request.jwt.claim.sub',(select u.id::text from public.usuarios u join public.permissoes p on p.usuario_id=u.id and p.empresa_id=u.empresa_id where u.role<>'master' and p.setor_id='orcamentos' and p.nivel='edicao' limit 1),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$
declare v_uid uuid:=auth.uid(); v_empresa uuid; v_orc uuid; v_count int; v_home text; v_venda text; begin
  select empresa_id into v_empresa from public.usuarios where id=v_uid;
  select id into v_orc from public.orcamentos where empresa_id=v_empresa limit 1;
  if v_orc is null then raise exception 'Sem orçamento para teste'; end if;
  v_venda:='dados_venda_'||v_orc::text;
  delete from public.configuracoes_gerais where empresa_id=v_empresa and chave=v_venda;
  insert into public.configuracoes_gerais(empresa_id,chave,valor,updated_at) values(v_empresa,v_venda,'{"p0":true}',now());
  if not exists(select 1 from public.configuracoes_gerais where empresa_id=v_empresa and chave=v_venda) then raise exception 'Dados de venda não foram permitidos'; end if;
  v_home:='home_usuario:'||v_uid::text;
  delete from public.configuracoes_gerais where empresa_id=v_empresa and chave=v_home;
  insert into public.configuracoes_gerais(empresa_id,chave,valor,updated_at) values(v_empresa,v_home,'{"modulos":[]}',now());
  if not exists(select 1 from public.configuracoes_gerais where empresa_id=v_empresa and chave=v_home) then raise exception 'Home própria não foi permitida'; end if;
  update public.configuracoes_gerais set valor='P0_FORBIDDEN' where empresa_id=v_empresa and chave='dados_empresa';
  get diagnostics v_count=row_count;
  if v_count<>0 then raise exception 'Configuração corporativa foi alterada'; end if;
end $$;
rollback;
select 'P0_CONFIG_GERAIS_VENDA_SCOPE_OK' as resultado;
