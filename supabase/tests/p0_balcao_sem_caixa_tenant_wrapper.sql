begin;
do $$
declare v_master uuid; v_a uuid; v_b uuid:=gen_random_uuid(); v_unidade uuid:=gen_random_uuid(); v_local uuid:=gen_random_uuid(); v_ok boolean:=false;
begin
  select id,empresa_id into v_master,v_a from public.usuarios where role='master' limit 1;
  insert into public.empresas(id,nome,slug,ativo) values(v_b,'P0 Empresa B2','p0-empresa-b2-'||substr(v_b::text,1,8),true);
  insert into public.unidades_operacionais(id,empresa_id,codigo,nome) values(v_unidade,v_a,'P0U2','P0 Unidade 2');
  insert into public.estoque_locais(id,empresa_id,unidade_id,codigo,nome) values(v_local,v_a,v_unidade,'P0L2','P0 Local 2');
  update public.usuarios set empresa_id=v_b where id=v_master;
  begin
    perform public.finalizar_venda_balcao_sem_caixa(v_master,'nome falso','master',null,null,jsonb_build_array(jsonb_build_object('produtoId',gen_random_uuid()::text,'quantidade',1,'precoUnitario',1)),'[]'::jsonb,0,null,false);
  exception when others then
    if sqlerrm='Nenhum local de estoque disponível para a empresa.' then v_ok:=true; else raise; end if;
  end;
  if not v_ok then raise exception 'Wrapper sem caixa usou local de outro tenant'; end if;
end $$;
rollback;

begin;
do $$
declare v_user uuid; v_a uuid; v_nome text; v_unidade uuid:=gen_random_uuid(); v_local uuid:=gen_random_uuid(); v_prod uuid:=gen_random_uuid(); v_ok boolean:=false;
begin
  select u.id,u.empresa_id,u.nome into v_user,v_a,v_nome from public.usuarios u join public.permissoes p on p.usuario_id=u.id and p.empresa_id=u.empresa_id where p.setor_id='venda-balcao' and p.nivel='edicao' limit 1;
  insert into public.unidades_operacionais(id,empresa_id,codigo,nome) values(v_unidade,v_a,'P0UC2','P0 Unidade Compat 2');
  insert into public.estoque_locais(id,empresa_id,unidade_id,codigo,nome) values(v_local,v_a,v_unidade,'GERAL','P0 Local Compat 2');
  insert into public.produtos(id,empresa_id,nome,preco,ativo) values(v_prod,v_a,'P0 Produto',1,true);
  begin
    perform public.finalizar_venda_balcao_sem_caixa(v_user,'nome injetado','master',null,null,jsonb_build_array(jsonb_build_object('produtoId',v_prod::text,'quantidade',1,'precoUnitario',1)),'[]'::jsonb,0,null,false);
  exception when others then
    if sqlerrm='Informe o pagamento.' then v_ok:=true; else raise; end if;
  end;
  if not v_ok then raise exception 'Fluxo legítimo sem caixa não atravessou o gate'; end if;
end $$;
rollback;
select 'P0_BALCAO_SEM_CAIXA_TENANT_OK' as tenant_test, 'P0_BALCAO_SEM_CAIXA_COMPAT_OK' as compat_test;