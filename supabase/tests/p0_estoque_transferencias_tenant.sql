begin;

create temp table transf_tenant_ctx as
select
  (select id from public.usuarios where role <> 'master' and empresa_id is not null order by created_at limit 1) as user_b,
  null::uuid as empresa_a,
  null::uuid as empresa_b,
  null::uuid as produto_a,
  null::uuid as local_a1,
  null::uuid as local_a2,
  null::uuid as transferencia_a,
  false as bloqueou_criacao_cross,
  false as bloqueou_avanco_cross;

do $$
begin
  if (select user_b is null from transf_tenant_ctx) then
    raise exception 'Teste de transferências precisa de usuário não-master existente';
  end if;
end $$;

insert into public.empresas(nome,slug) values
 ('Tenant Transfer A CI','tenant-transfer-a-ci'),
 ('Tenant Transfer B CI','tenant-transfer-b-ci');

update transf_tenant_ctx set
 empresa_a=(select id from public.empresas where slug='tenant-transfer-a-ci'),
 empresa_b=(select id from public.empresas where slug='tenant-transfer-b-ci');

update public.usuarios set empresa_id=(select empresa_b from transf_tenant_ctx)
where id=(select user_b from transf_tenant_ctx);

insert into public.produtos(nome,categoria,preco,empresa_id)
values ('__PRODUTO_TRANSFER_A_CI__','outro',0,(select empresa_a from transf_tenant_ctx));
update transf_tenant_ctx set produto_a=(select id from public.produtos where nome='__PRODUTO_TRANSFER_A_CI__' limit 1);

insert into public.unidades_operacionais(codigo,nome,tipo,empresa_id)
values ('TTA-CI','Tenant Transfer A','deposito',(select empresa_a from transf_tenant_ctx));

insert into public.estoque_locais(unidade_id,codigo,nome,tipo,empresa_id)
select id,'ORIGEM-TTA-CI','Origem A','geral',empresa_id from public.unidades_operacionais where codigo='TTA-CI';
insert into public.estoque_locais(unidade_id,codigo,nome,tipo,empresa_id)
select id,'DESTINO-TTA-CI','Destino A','geral',empresa_id from public.unidades_operacionais where codigo='TTA-CI';

update transf_tenant_ctx set
 local_a1=(select id from public.estoque_locais where codigo='ORIGEM-TTA-CI' limit 1),
 local_a2=(select id from public.estoque_locais where codigo='DESTINO-TTA-CI' limit 1);

insert into public.estoque_saldos(produto_id,local_id,quantidade,quantidade_reservada,empresa_id)
select produto_a,local_a1,10,0,empresa_a from transf_tenant_ctx;

insert into public.estoque_transferencias(local_origem_id,local_destino_id,motivo,solicitado_por_id,solicitado_por_nome,empresa_id)
select local_a1,local_a2,'teste_ci',user_b,'Tenant B',empresa_a from transf_tenant_ctx;
update transf_tenant_ctx set transferencia_a=(select id from public.estoque_transferencias where motivo='teste_ci' and empresa_id=empresa_a limit 1);

do $$
declare c transf_tenant_ctx%rowtype;
begin
  select * into c from transf_tenant_ctx;
  begin
    perform public.criar_transferencia_estoque(
      c.local_a1,c.local_a2,
      jsonb_build_array(jsonb_build_object('produtoId',c.produto_a::text,'quantidade',1)),
      'cross',null,c.user_b,'Tenant B'
    );
    raise exception 'Criação cross-tenant não foi bloqueada';
  exception when others then
    if sqlerrm='Criação cross-tenant não foi bloqueada' then raise; end if;
    update transf_tenant_ctx set bloqueou_criacao_cross=true;
  end;
end $$;

do $$
declare c transf_tenant_ctx%rowtype;
begin
  select * into c from transf_tenant_ctx;
  begin
    perform public.avancar_transferencia_estoque(c.transferencia_a,'separar',c.user_b,'Tenant B');
    raise exception 'Avanço cross-tenant não foi bloqueado';
  exception when others then
    if sqlerrm='Avanço cross-tenant não foi bloqueado' then raise; end if;
    update transf_tenant_ctx set bloqueou_avanco_cross=true;
  end;
end $$;

do $$
begin
  if not (select bloqueou_criacao_cross and bloqueou_avanco_cross from transf_tenant_ctx) then
    raise exception 'Proteção cross-tenant de transferências não foi comprovada';
  end if;
end $$;

rollback;
