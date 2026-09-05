begin;
create temporary table p0_prec_ctx as select u.id usuario_id,u.empresa_id empresa_a from public.usuarios u where u.role='master' limit 1;
create temporary table p0_empresa_b as select gen_random_uuid() id;
grant select on p0_prec_ctx,p0_empresa_b to authenticated;
insert into public.empresas(id,nome,slug,ativo) select id,'Empresa B P0','empresa-b-p0-'||substr(replace(id::text,'-',''),1,8),true from p0_empresa_b;
update public.usuarios set empresa_id=(select id from p0_empresa_b) where id=(select usuario_id from p0_prec_ctx);
set local role authenticated;
select set_config('request.jwt.claim.sub',(select usuario_id::text from p0_prec_ctx),true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$ declare c integer; ok_insert boolean:=false; v_a uuid; begin
  select empresa_a into v_a from p0_prec_ctx;
  select count(*) into c from public.configuracoes_precificacao;
  if c<>0 then raise exception 'Empresa B enxergou precificação da Empresa A'; end if;
  begin insert into public.configuracoes_precificacao(chave,valor,empresa_id) values('p0_teste',1,v_a); exception when others then ok_insert:=true; end;
  if not ok_insert then raise exception 'Empresa B conseguiu gravar precificação da Empresa A'; end if;
end $$;
reset role;
rollback;
select 'P0_PRECIFICACAO_TENANT_OK' resultado;
