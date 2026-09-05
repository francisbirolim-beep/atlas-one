begin;

create temp table end_tenant_ctx as
select
  (select id from public.usuarios where role <> 'master' and empresa_id is not null order by created_at limit 1) as user_b,
  null::uuid as empresa_a,
  null::uuid as empresa_b,
  null::uuid as produto_a,
  null::uuid as local_a,
  null::uuid as endereco_a,
  null::uuid as saldo_a,
  false as bloqueou_cross;

do $$
begin
  if (select user_b is null from end_tenant_ctx) then
    raise exception 'Teste de endereçamento precisa de usuário não-master existente';
  end if;
end $$;

insert into public.empresas(nome,slug) values
 ('Tenant End A CI','tenant-end-a-ci'),
 ('Tenant End B CI','tenant-end-b-ci');

update end_tenant_ctx set
 empresa_a=(select id from public.empresas where slug='tenant-end-a-ci'),
 empresa_b=(select id from public.empresas where slug='tenant-end-b-ci');

update public.usuarios set empresa_id=(select empresa_b from end_tenant_ctx)
where id=(select user_b from end_tenant_ctx);

insert into public.produtos(nome,categoria,preco,empresa_id)
values ('__PRODUTO_END_A_CI__','outro',0,(select empresa_a from end_tenant_ctx));
update end_tenant_ctx set produto_a=(select id from public.produtos where nome='__PRODUTO_END_A_CI__' limit 1);

insert into public.unidades_operacionais(codigo,nome,tipo,empresa_id)
values ('TEA-CI','Tenant End A','deposito',(select empresa_a from end_tenant_ctx));
insert into public.estoque_locais(unidade_id,codigo,nome,tipo,empresa_id)
select id,'LOCAL-TEA-CI','Local End A','geral',empresa_id from public.unidades_operacionais where codigo='TEA-CI';
update end_tenant_ctx set local_a=(select id from public.estoque_locais where codigo='LOCAL-TEA-CI' limit 1);

insert into public.estoque_enderecos(local_id,codigo,ativo,empresa_id)
select local_a,'END-TEA-CI',true,empresa_a from end_tenant_ctx;
update end_tenant_ctx set endereco_a=(select id from public.estoque_enderecos where codigo='END-TEA-CI' limit 1);

insert into public.estoque_saldos(produto_id,local_id,quantidade,quantidade_reservada,empresa_id)
select produto_a,local_a,10,0,empresa_a from end_tenant_ctx;
update end_tenant_ctx set saldo_a=(select id from public.estoque_saldos where produto_id=produto_a and local_id=local_a and endereco_id is null limit 1);

do $$
declare c end_tenant_ctx%rowtype;
begin
  select * into c from end_tenant_ctx;
  begin
    perform public.movimentar_estoque_interno(c.saldo_a,c.endereco_a,1,c.user_b,'Tenant B');
    raise exception 'Endereçamento cross-tenant não foi bloqueado';
  exception when others then
    if sqlerrm='Endereçamento cross-tenant não foi bloqueado' then raise; end if;
    update end_tenant_ctx set bloqueou_cross=true;
  end;
end $$;

do $$
begin
  if not (select bloqueou_cross from end_tenant_ctx) then
    raise exception 'Proteção cross-tenant do endereçamento não foi comprovada';
  end if;
end $$;

rollback;
