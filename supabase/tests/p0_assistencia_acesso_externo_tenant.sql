begin;

create temp table assistencia_acesso_tenant_ctx as
select
  a.id as assistencia_id,
  a.empresa_id as empresa_a,
  null::uuid as empresa_b,
  false as bloqueou_cross_tenant
from public.assistencias a
where a.empresa_id is not null
order by a.created_at
limit 1;

do $$
begin
  if (select assistencia_id is null or empresa_a is null from assistencia_acesso_tenant_ctx) then
    raise exception 'Teste requer assistência existente';
  end if;
end $$;

insert into public.empresas(nome,slug) values ('Tenant Assistência CI','tenant-assistencia-ci');
update assistencia_acesso_tenant_ctx set empresa_b=(select id from public.empresas where slug='tenant-assistencia-ci');

do $$
declare
  v_assistencia uuid;
  v_empresa_b uuid;
begin
  select assistencia_id,empresa_b into v_assistencia,v_empresa_b from assistencia_acesso_tenant_ctx;
  begin
    insert into public.assistencia_acessos_externos(empresa_id,assistencia_id,token_hash,expira_em)
    values(v_empresa_b,v_assistencia,encode(digest(gen_random_uuid()::text,'sha256'),'hex'),now()+interval '1 day');
    raise exception 'Guard permitiu link cross-tenant';
  exception when others then
    if sqlerrm = 'Guard permitiu link cross-tenant' then raise; end if;
    if position('Acesso externo pertence a outra empresa' in sqlerrm) = 0 then raise; end if;
    update assistencia_acesso_tenant_ctx set bloqueou_cross_tenant=true;
  end;
end $$;

do $$
begin
  if not (select bloqueou_cross_tenant from assistencia_acesso_tenant_ctx) then
    raise exception 'Proteção cross-tenant do acesso externo não foi comprovada';
  end if;
end $$;

rollback;