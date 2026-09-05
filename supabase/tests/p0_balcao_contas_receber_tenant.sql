begin;

create temp table balcao_cr_tenant_ctx as
select
  (select id from public.usuarios where role <> 'master' and empresa_id is not null order by created_at limit 1) as user_b,
  null::uuid as empresa_a,
  null::uuid as empresa_b,
  null::uuid as cliente_a,
  null::uuid as conta_a,
  null::uuid as caixa_b,
  false as bloqueou_baixa_cross;

do $$
begin
  if (select user_b is null from balcao_cr_tenant_ctx) then
    raise exception 'Teste de contas a receber precisa de usuário não-master existente';
  end if;
end $$;

insert into public.empresas(nome,slug) values
 ('Tenant CR A CI','tenant-cr-a-ci'),
 ('Tenant CR B CI','tenant-cr-b-ci');

update balcao_cr_tenant_ctx set
 empresa_a=(select id from public.empresas where slug='tenant-cr-a-ci'),
 empresa_b=(select id from public.empresas where slug='tenant-cr-b-ci');

update public.usuarios set empresa_id=(select empresa_b from balcao_cr_tenant_ctx)
where id=(select user_b from balcao_cr_tenant_ctx);

insert into public.clientes(nome,origem,empresa_id)
values ('__CLIENTE_CR_A_CI__','outros',(select empresa_a from balcao_cr_tenant_ctx));
update balcao_cr_tenant_ctx set cliente_a=(select id from public.clientes where nome='__CLIENTE_CR_A_CI__' limit 1);

insert into public.financeiro_contas_receber(cliente_id,cliente_nome,documento,valor,status,empresa_id)
select cliente_a,'Cliente A','__CONTA_A_CI__',100,'aberto',empresa_a from balcao_cr_tenant_ctx;
update balcao_cr_tenant_ctx set conta_a=(select id from public.financeiro_contas_receber where documento='__CONTA_A_CI__' limit 1);

insert into public.balcao_caixas(operador_id,operador_nome,status,empresa_id)
select user_b,'Tenant B','aberto',empresa_b from balcao_cr_tenant_ctx;
update balcao_cr_tenant_ctx set caixa_b=(select id from public.balcao_caixas where operador_id=user_b and empresa_id=empresa_b order by created_at desc limit 1);

do $$
declare c balcao_cr_tenant_ctx%rowtype;
begin
  select * into c from balcao_cr_tenant_ctx;
  begin
    perform public.baixar_conta_receber_balcao(c.conta_a,c.user_b,'Tenant B','pix',100,c.caixa_b);
    raise exception 'Baixa cross-tenant não foi bloqueada';
  exception when others then
    if sqlerrm='Baixa cross-tenant não foi bloqueada' then raise; end if;
    update balcao_cr_tenant_ctx set bloqueou_baixa_cross=true;
  end;
end $$;

do $$
begin
  if not (select bloqueou_baixa_cross from balcao_cr_tenant_ctx) then
    raise exception 'Proteção cross-tenant da baixa de contas a receber não foi comprovada';
  end if;
end $$;

rollback;
