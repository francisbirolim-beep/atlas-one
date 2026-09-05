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
values ('Tenant Teste CI', 'tenant-teste-ci')
returning id into strict _tenant_test_empresa_b;
