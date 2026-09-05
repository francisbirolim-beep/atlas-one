begin;

create temp table medicao_acesso_tenant_ctx as
select m.id as medicao_id,m.empresa_id as empresa_a,null::uuid as empresa_b,false as bloqueou_cross_tenant
from public.medicoes_finais m
where m.empresa_id is not null
order by m.created_at
limit 1;

do $$
begin
  if (select medicao_id is null or empresa_a is null from medicao_acesso_tenant_ctx) then
    raise exception 'Teste requer medição existente';
  end if;
end $$;

insert into public.empresas(nome,slug) values ('Tenant Medição CI','tenant-medicao-ci');
update medicao_acesso_tenant_ctx set empresa_b=(select id from public.empresas where slug='tenant-medicao-ci');

do $$
declare
  v_medicao uuid;
  v_empresa_b uuid;
begin
  select medicao_id,empresa_b into v_medicao,v_empresa_b from medicao_acesso_tenant_ctx;
  begin
    insert into public.medicao_acessos_externos(empresa_id,medicao_id,token_hash,expira_em)
    values(v_empresa_b,v_medicao,encode(digest(gen_random_uuid()::text,'sha256'),'hex'),now()+interval '1 day');
    raise exception 'Guard permitiu link cross-tenant';
  exception when others then
    if sqlerrm = 'Guard permitiu link cross-tenant' then raise; end if;
    if position('Acesso externo pertence a outra empresa' in sqlerrm) = 0 then raise; end if;
    update medicao_acesso_tenant_ctx set bloqueou_cross_tenant=true;
  end;
end $$;

do $$
begin
  if not (select bloqueou_cross_tenant from medicao_acesso_tenant_ctx) then
    raise exception 'Proteção cross-tenant do acesso externo de medição não foi comprovada';
  end if;
end $$;

rollback;