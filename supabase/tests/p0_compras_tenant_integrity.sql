begin;

create temp table compras_tenant_ctx as
select
  (select id from public.usuarios where role <> 'master' and empresa_id is not null order by created_at limit 1) as user_b,
  (select id from public.fornecedores where empresa_id=(select id from public.empresas where slug='esquadrifacio') limit 1) as fornecedor_a,
  null::uuid as empresa_b,
  false as bloqueou_cross_tenant;

do $$
begin
  if (select user_b is null or fornecedor_a is null from compras_tenant_ctx) then
    raise exception 'Teste de compras precisa de usuário não-master e fornecedor da Esquadrifácio';
  end if;
end $$;

insert into public.empresas(nome,slug) values ('Tenant Compras CI','tenant-compras-ci');
update compras_tenant_ctx set empresa_b=(select id from public.empresas where slug='tenant-compras-ci');
update public.usuarios set empresa_id=(select empresa_b from compras_tenant_ctx) where id=(select user_b from compras_tenant_ctx);

insert into public.fornecedores(nome,empresa_id) values ('__FORNECEDOR_B_CI__',(select empresa_b from compras_tenant_ctx));
insert into public.produtos(nome,categoria,preco,empresa_id) values ('__PRODUTO_B_COMPRAS_CI__','outro',0,(select empresa_b from compras_tenant_ctx));

insert into public.compras_necessidades(descricao,quantidade,unidade,criado_por_id,responsavel_id,produto_id)
select '__NECESSIDADE_B_CI__',1,'UN',c.user_b,c.user_b,p.id
from compras_tenant_ctx c join public.produtos p on p.nome='__PRODUTO_B_COMPRAS_CI__';

insert into public.compras_cotacoes(necessidade_id,fornecedor_id,preco_unitario,criado_por_id)
select n.id,f.id,10,c.user_b
from public.compras_necessidades n
join public.fornecedores f on f.nome='__FORNECEDOR_B_CI__'
cross join compras_tenant_ctx c
where n.descricao='__NECESSIDADE_B_CI__';

do $$
declare e uuid; ne uuid; ce uuid;
begin
  select empresa_b into e from compras_tenant_ctx;
  select empresa_id into ne from public.compras_necessidades where descricao='__NECESSIDADE_B_CI__' limit 1;
  select c.empresa_id into ce from public.compras_cotacoes c join public.compras_necessidades n on n.id=c.necessidade_id where n.descricao='__NECESSIDADE_B_CI__' limit 1;
  if ne is distinct from e then raise exception 'Necessidade não herdou empresa correta'; end if;
  if ce is distinct from e then raise exception 'Cotação não herdou empresa correta'; end if;
end $$;

do $$
declare n_id uuid; f_a uuid; u_b uuid;
begin
  select id into n_id from public.compras_necessidades where descricao='__NECESSIDADE_B_CI__' limit 1;
  select fornecedor_a,user_b into f_a,u_b from compras_tenant_ctx;
  begin
    insert into public.compras_cotacoes(necessidade_id,fornecedor_id,preco_unitario,criado_por_id)
    values(n_id,f_a,20,u_b);
    raise exception 'Cross-tenant não foi bloqueado';
  exception
    when others then
      if sqlerrm = 'Cross-tenant não foi bloqueado' then raise; end if;
      update compras_tenant_ctx set bloqueou_cross_tenant=true;
  end;
end $$;

do $$
begin
  if not (select bloqueou_cross_tenant from compras_tenant_ctx) then
    raise exception 'Cotação cross-tenant não foi bloqueada';
  end if;
end $$;

rollback;
