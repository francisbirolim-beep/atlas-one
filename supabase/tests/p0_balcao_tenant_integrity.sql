begin;

create temp table balcao_tenant_ctx as
select
  (select id from public.usuarios where role <> 'master' and empresa_id is not null order by created_at limit 1) as user_b,
  null::uuid as empresa_b;

do $$
begin
  if (select user_b is null from balcao_tenant_ctx) then
    raise exception 'Teste do balcão precisa de um usuário não-master';
  end if;
end $$;

insert into public.empresas(nome,slug) values ('Tenant Balcao CI','tenant-balcao-ci');
update balcao_tenant_ctx set empresa_b=(select id from public.empresas where slug='tenant-balcao-ci');
update public.usuarios set empresa_id=(select empresa_b from balcao_tenant_ctx) where id=(select user_b from balcao_tenant_ctx);
insert into public.clientes(nome,empresa_id) values ('__BALCAO_TENANT_CI__',(select empresa_b from balcao_tenant_ctx));

insert into public.balcao_vendas(cliente_id,cliente_nome,vendedor_id,vendedor_nome,subtotal,total)
select c.id,c.nome,u.id,u.nome,100,100
from public.clientes c cross join public.usuarios u
where c.nome='__BALCAO_TENANT_CI__' and u.id=(select user_b from balcao_tenant_ctx)
limit 1;

insert into public.balcao_pagamentos(venda_id,forma,valor)
select id,'pix',100 from public.balcao_vendas where cliente_nome='__BALCAO_TENANT_CI__' limit 1;

do $$
declare v_empresa uuid; p_empresa uuid;
begin
  select empresa_id into v_empresa from public.balcao_vendas where cliente_nome='__BALCAO_TENANT_CI__' limit 1;
  select p.empresa_id into p_empresa from public.balcao_pagamentos p join public.balcao_vendas v on v.id=p.venda_id where v.cliente_nome='__BALCAO_TENANT_CI__' limit 1;
  if v_empresa is null or v_empresa <> (select empresa_b from balcao_tenant_ctx) then
    raise exception 'Venda não herdou a empresa correta';
  end if;
  if p_empresa is null or p_empresa <> v_empresa then
    raise exception 'Pagamento não herdou a empresa da venda';
  end if;
end $$;

rollback;
