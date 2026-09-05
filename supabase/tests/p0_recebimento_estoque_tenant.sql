begin;

create temp table recebimento_tenant_ctx as
select
  u.id as usuario_id,
  u.empresa_id as empresa_a,
  (select p.id from public.produtos p where p.empresa_id=u.empresa_id order by p.created_at limit 1) as produto_a,
  null::uuid as empresa_b,
  gen_random_uuid() as nf_id,
  gen_random_uuid() as nf_item_id,
  gen_random_uuid() as recebimento_id,
  gen_random_uuid() as recebimento_item_id,
  false as bloqueou_cross_tenant
from public.usuarios u
where u.empresa_id is not null
order by u.created_at
limit 1;

do $$
begin
  if (select usuario_id is null or empresa_a is null or produto_a is null from recebimento_tenant_ctx) then
    raise exception 'Teste requer usuário e produto existentes';
  end if;
end $$;

insert into public.empresas(nome,slug) values ('Tenant Recebimento CI','tenant-recebimento-ci');
update recebimento_tenant_ctx set empresa_b=(select id from public.empresas where slug='tenant-recebimento-ci');

insert into public.compras_nfs(id,empresa_id,origem_entrada,status,criado_por_id)
select nf_id,empresa_a,'manual','confirmada',usuario_id from recebimento_tenant_ctx;

insert into public.compras_nf_itens(id,empresa_id,nf_id,produto_id,descricao,quantidade,vinculo_status)
select nf_item_id,empresa_a,nf_id,produto_a,'ITEM TESTE TENANT',1,'vinculado' from recebimento_tenant_ctx;

insert into public.compras_recebimentos(id,empresa_id,nf_id,status,recebido_por_id)
select recebimento_id,empresa_a,nf_id,'concluido',usuario_id from recebimento_tenant_ctx;

insert into public.compras_recebimento_itens(
  id,empresa_id,recebimento_id,nf_item_id,produto_id,quantidade_nf,quantidade_recebida,quantidade_avariada,status
)
select recebimento_item_id,empresa_a,recebimento_id,nf_item_id,produto_a,1,1,0,'ok' from recebimento_tenant_ctx;

update public.usuarios
set empresa_id=(select empresa_b from recebimento_tenant_ctx)
where id=(select usuario_id from recebimento_tenant_ctx);

do $$
declare
  v_item uuid;
  v_user uuid;
begin
  select recebimento_item_id,usuario_id into v_item,v_user from recebimento_tenant_ctx;
  begin
    perform public.aplicar_estoque_recebimento(v_item,v_user,'Tenant B');
    raise exception 'RPC permitiu recebimento cross-tenant';
  exception when others then
    if sqlerrm = 'RPC permitiu recebimento cross-tenant' then raise; end if;
    if position('Item de recebimento não encontrado para a empresa atual' in sqlerrm) = 0 then raise; end if;
    update recebimento_tenant_ctx set bloqueou_cross_tenant=true;
  end;
end $$;

do $$
begin
  if not (select bloqueou_cross_tenant from recebimento_tenant_ctx) then
    raise exception 'Proteção cross-tenant do recebimento não foi comprovada';
  end if;
end $$;

rollback;