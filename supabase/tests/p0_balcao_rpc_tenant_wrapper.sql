begin;
do $$
declare
  v_master uuid; v_a uuid; v_b uuid:=gen_random_uuid(); v_unidade uuid:=gen_random_uuid(); v_local uuid:=gen_random_uuid(); v_ponto uuid:=gen_random_uuid(); v_caixa uuid:=gen_random_uuid(); v_ok boolean:=false;
begin
  select id,empresa_id into v_master,v_a from public.usuarios where role='master' limit 1;
  if v_master is null or v_a is null then raise exception 'Sem Master/empresa para teste'; end if;
  insert into public.empresas(id,nome,slug,ativo) values(v_b,'P0 Empresa B','p0-empresa-b-'||substr(v_b::text,1,8),true);
  insert into public.unidades_operacionais(id,empresa_id,codigo,nome) values(v_unidade,v_a,'P0U','P0 Unidade');
  insert into public.estoque_locais(id,empresa_id,unidade_id,codigo,nome) values(v_local,v_a,v_unidade,'P0L','P0 Local');
  insert into public.balcao_pontos_caixa(id,empresa_id,unidade_id,local_estoque_id,codigo,nome) values(v_ponto,v_a,v_unidade,v_local,'P0P','P0 Ponto');
  insert into public.balcao_caixas(id,empresa_id,status,operador_id,operador_nome,ponto_caixa_id,unidade_id,local_estoque_id,saldo_inicial) values(v_caixa,v_a,'aberto',v_master,'P0 Master',v_ponto,v_unidade,v_local,0);
  update public.usuarios set empresa_id=v_b where id=v_master;
  begin
    perform public.finalizar_venda_balcao(v_caixa,v_master,'nome falso','master',null,null,'[]'::jsonb,'[]'::jsonb,0,null,false);
  exception when others then
    if sqlerrm like '%Caixa pertence a outra empresa%' then v_ok:=true; else raise; end if;
  end;
  if not v_ok then raise exception 'Wrapper não bloqueou caixa cross-tenant'; end if;
end $$;
rollback;

begin;
do $$
declare
  v_user uuid; v_a uuid; v_nome text; v_unidade uuid:=gen_random_uuid(); v_local uuid:=gen_random_uuid(); v_ponto uuid:=gen_random_uuid(); v_caixa uuid:=gen_random_uuid(); v_ok boolean:=false;
begin
  select u.id,u.empresa_id,u.nome into v_user,v_a,v_nome
  from public.usuarios u join public.permissoes p on p.usuario_id=u.id and p.empresa_id=u.empresa_id
  where p.setor_id='venda-balcao' and p.nivel='edicao' limit 1;
  if v_user is null then raise exception 'Sem usuário autorizado para teste'; end if;
  insert into public.unidades_operacionais(id,empresa_id,codigo,nome) values(v_unidade,v_a,'P0UC','P0 Unidade Compat');
  insert into public.estoque_locais(id,empresa_id,unidade_id,codigo,nome) values(v_local,v_a,v_unidade,'P0LC','P0 Local Compat');
  insert into public.balcao_pontos_caixa(id,empresa_id,unidade_id,local_estoque_id,codigo,nome) values(v_ponto,v_a,v_unidade,v_local,'P0PC','P0 Ponto Compat');
  insert into public.balcao_caixas(id,empresa_id,status,operador_id,operador_nome,ponto_caixa_id,unidade_id,local_estoque_id,saldo_inicial) values(v_caixa,v_a,'aberto',v_user,v_nome,v_ponto,v_unidade,v_local,0);
  begin
    perform public.finalizar_venda_balcao(v_caixa,v_user,'nome injetado','master',null,null,'[]'::jsonb,'[]'::jsonb,0,null,false);
  exception when others then
    if sqlerrm='Venda sem itens.' then v_ok:=true; else raise; end if;
  end;
  if not v_ok then raise exception 'Fluxo legítimo não atravessou o gate'; end if;
end $$;
rollback;
select 'P0_BALCAO_RPC_TENANT_OK' as tenant_test, 'P0_BALCAO_RPC_COMPAT_OK' as compat_test;