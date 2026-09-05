begin;
create temporary table p0_ctx as
select u.id usuario_id,u.empresa_id empresa_a,
       (select id from public.produtos where empresa_id=u.empresa_id limit 1) produto_id,
       (select coluna_id from public.automacoes_setor where empresa_id=u.empresa_id limit 1) coluna_a
from public.usuarios u where u.role='master' limit 1;
create temporary table p0_b as select gen_random_uuid() empresa_b;
grant select on p0_ctx,p0_b to authenticated;
insert into public.empresas(id,nome,slug,ativo) select empresa_b,'Empresa B P0','empresa-b-'||substr(replace(empresa_b::text,'-',''),1,8),true from p0_b;
insert into public.planos_corte(nome,empresa_id) values('P0 Plano A',(select empresa_a from p0_ctx));
update public.produtos set empresa_id=(select empresa_b from p0_b) where id=(select produto_id from p0_ctx);
do $$ declare ok_guard boolean:=false; begin
  begin insert into public.planos_corte(nome,empresa_id,produto_id) values('P0 Cross',(select empresa_a from p0_ctx),(select produto_id from p0_ctx));
  exception when others then if sqlerrm like '%Empresa divergente no produto%' then ok_guard:=true; else raise; end if; end;
  if not ok_guard then raise exception 'Guard de plano não bloqueou produto cross-tenant'; end if;
end $$;
update public.usuarios set empresa_id=(select empresa_b from p0_b) where id=(select usuario_id from p0_ctx);
set local role authenticated;
select set_config('request.jwt.claim.sub',(select usuario_id::text from p0_ctx),true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ declare c integer; ok_auto boolean:=false; begin
  select count(*) into c from public.planos_corte; if c<>0 then raise exception 'Empresa B enxergou plano da Empresa A'; end if;
  select count(*) into c from public.automacoes_setor; if c<>0 then raise exception 'Empresa B enxergou automação da Empresa A'; end if;
  begin insert into public.automacoes_setor(coluna_id,setor_id,nome,ativo,empresa_id) values((select coluna_a from p0_ctx),'financeiro','P0',true,(select empresa_a from p0_ctx)); exception when others then ok_auto:=true; end;
  if not ok_auto then raise exception 'Empresa B criou automação na Empresa A'; end if;
end $$;
reset role;
rollback;
select 'P0_PLANOS_AUTOMACOES_TENANT_OK' resultado;
