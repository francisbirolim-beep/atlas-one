begin;

create temp table tenant_test_ctx as
select
  (select id from public.usuarios where role = 'master' and empresa_id is not null order by created_at limit 1) as user_a,
  (select id from public.usuarios where role <> 'master' and empresa_id is not null order by created_at limit 1) as user_b,
  (select id from public.empresas where slug = 'esquadrifacio' limit 1) as empresa_a,
  null::uuid as empresa_b;

create temp table tenant_test_result(label text primary key, valor bigint not null);
grant select on tenant_test_ctx to authenticated;
grant select, insert on tenant_test_result to authenticated;

do $$
begin
  if (select user_a is null or user_b is null or empresa_a is null from tenant_test_ctx) then
    raise exception 'Tenant isolation test precisa de empresa Esquadrifacio, um master e um funcionario';
  end if;
end $$;

insert into public.empresas(nome, slug)
values ('Tenant Teste CI', 'tenant-teste-ci');

update tenant_test_ctx
set empresa_b = (select id from public.empresas where slug = 'tenant-teste-ci');

update public.usuarios
set empresa_id = (select empresa_b from tenant_test_ctx)
where id = (select user_b from tenant_test_ctx);

insert into public.clientes(nome, empresa_id)
values
  ('__TENANT_CI_A__', (select empresa_a from tenant_test_ctx)),
  ('__TENANT_CI_B__', (select empresa_b from tenant_test_ctx));

select set_config('request.jwt.claim.sub', (select user_a::text from tenant_test_ctx), true);
set local role authenticated;
insert into tenant_test_result select 'A_ve_A', count(*) from public.clientes where nome='__TENANT_CI_A__';
insert into tenant_test_result select 'A_ve_B', count(*) from public.clientes where nome='__TENANT_CI_B__';
with u as (
  update public.clientes set cidade='INVASAO' where nome='__TENANT_CI_B__' returning 1
) insert into tenant_test_result select 'A_atualiza_B', count(*) from u;
reset role;

select set_config('request.jwt.claim.sub', (select user_b::text from tenant_test_ctx), true);
set local role authenticated;
insert into tenant_test_result select 'B_ve_B', count(*) from public.clientes where nome='__TENANT_CI_B__';
insert into tenant_test_result select 'B_ve_A', count(*) from public.clientes where nome='__TENANT_CI_A__';
with u as (
  update public.clientes set cidade='INVASAO' where nome='__TENANT_CI_A__' returning 1
) insert into tenant_test_result select 'B_atualiza_A', count(*) from u;
reset role;

do $$
begin
  if (select valor from tenant_test_result where label='A_ve_A') <> 1 then
    raise exception 'Falha tenant: Empresa A nao enxerga o proprio cliente';
  end if;
  if (select valor from tenant_test_result where label='A_ve_B') <> 0 then
    raise exception 'Falha tenant: Empresa A enxergou cliente da Empresa B';
  end if;
  if (select valor from tenant_test_result where label='A_atualiza_B') <> 0 then
    raise exception 'Falha tenant: Empresa A alterou cliente da Empresa B';
  end if;
  if (select valor from tenant_test_result where label='B_ve_B') <> 1 then
    raise exception 'Falha tenant: Empresa B nao enxerga o proprio cliente';
  end if;
  if (select valor from tenant_test_result where label='B_ve_A') <> 0 then
    raise exception 'Falha tenant: Empresa B enxergou cliente da Empresa A';
  end if;
  if (select valor from tenant_test_result where label='B_atualiza_A') <> 0 then
    raise exception 'Falha tenant: Empresa B alterou cliente da Empresa A';
  end if;
end $$;

rollback;
