begin;

create temp table cancel_tenant_ctx as
select
  (select id from public.usuarios where role <> 'master' and empresa_id is not null order by created_at limit 1) as user_teste,
  null::uuid as empresa_a,
  null::uuid as empresa_b,
  null::uuid as venda_a,
  null::uuid as evento_a,
  false as bloqueou_cancelamento_cross,
  false as bloqueou_reembolso_cross;

do $$
begin
  if (select user_teste is null from cancel_tenant_ctx) then
    raise exception 'Teste de cancelamento precisa de usuário não-master existente';
  end if;
end $$;

insert into public.empresas(nome,slug) values
 ('Tenant Cancel A CI','tenant-cancel-a-ci'),
 ('Tenant Cancel B CI','tenant-cancel-b-ci');

update cancel_tenant_ctx set
 empresa_a=(select id from public.empresas where slug='tenant-cancel-a-ci'),
 empresa_b=(select id from public.empresas where slug='tenant-cancel-b-ci');

-- Cria uma venda válida da Empresa A usando o próprio guard de vendedor.
update public.usuarios set empresa_id=(select empresa_a from cancel_tenant_ctx)
where id=(select user_teste from cancel_tenant_ctx);

insert into public.balcao_vendas(numero,status,vendedor_id,vendedor_nome,subtotal,total,empresa_id)
select coalesce((select max(numero) from public.balcao_vendas),0)+1000000,'finalizada',user_teste,'Usuário Teste',100,100,empresa_a
from cancel_tenant_ctx;

update cancel_tenant_ctx set venda_a=(select id from public.balcao_vendas where vendedor_id=user_teste and empresa_id=empresa_a order by created_at desc limit 1);

insert into public.balcao_venda_eventos(venda_id,tipo,status,motivo,valor,usuario_id,usuario_nome,empresa_id)
select venda_a,'reembolso_pendente','pendente','Teste CI',100,user_teste,'Usuário Teste',empresa_a
from cancel_tenant_ctx;

update cancel_tenant_ctx set evento_a=(select id from public.balcao_venda_eventos where venda_id=venda_a and tipo='reembolso_pendente' order by created_at desc limit 1);

-- O mesmo usuário passa a representar a Empresa B para simular ataque A x B.
update public.usuarios set empresa_id=(select empresa_b from cancel_tenant_ctx)
where id=(select user_teste from cancel_tenant_ctx);

do $$
declare c cancel_tenant_ctx%rowtype;
begin
  select * into c from cancel_tenant_ctx;
  begin
    perform public.processar_cancelamento_devolucao_balcao(
      c.venda_a,'cancelamento_total','[]'::jsonb,'cross-tenant',null,
      c.user_teste,'Tenant B',false,null,gen_random_uuid()
    );
    raise exception 'Cancelamento cross-tenant não foi bloqueado';
  exception when others then
    if sqlerrm='Cancelamento cross-tenant não foi bloqueado' then raise; end if;
    update cancel_tenant_ctx set bloqueou_cancelamento_cross=true;
  end;
end $$;

do $$
declare c cancel_tenant_ctx%rowtype;
begin
  select * into c from cancel_tenant_ctx;
  begin
    perform public.concluir_reembolso_balcao(c.evento_a,c.user_teste,'Tenant B',false,null,null);
    raise exception 'Reembolso cross-tenant não foi bloqueado';
  exception when others then
    if sqlerrm='Reembolso cross-tenant não foi bloqueado' then raise; end if;
    update cancel_tenant_ctx set bloqueou_reembolso_cross=true;
  end;
end $$;

do $$
begin
  if not (select bloqueou_cancelamento_cross and bloqueou_reembolso_cross from cancel_tenant_ctx) then
    raise exception 'Proteção cross-tenant de cancelamento/reembolso não foi comprovada';
  end if;
end $$;

rollback;
