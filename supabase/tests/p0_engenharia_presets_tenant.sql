begin;
create temporary table p0_ctx(u uuid, empresa_a uuid, preset uuid, produto_a uuid, empresa_b uuid) on commit drop;
insert into p0_ctx(u,empresa_a,preset,produto_a,empresa_b)
select u.id,u.empresa_id,p.id,(select id from public.produtos where empresa_id=u.empresa_id limit 1),gen_random_uuid()
from public.usuarios u join public.engenharia_variaveis_preset p on p.empresa_id=u.empresa_id
where u.role='master' limit 1;
grant select on p0_ctx to authenticated;
insert into public.empresas(id,nome,slug,ativo) select empresa_b,'Empresa B Teste','empresa-b-preset-'||substr(empresa_b::text,1,8),true from p0_ctx;
update public.usuarios set empresa_id=(select empresa_b from p0_ctx) where id=(select u from p0_ctx);
select set_config('request.jwt.claim.sub',(select u::text from p0_ctx),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $$ declare n int; begin select count(*) into n from public.engenharia_variaveis_preset where id=(select preset from p0_ctx); if n<>0 then raise exception 'Empresa B visualizou preset da Empresa A'; end if; end $$;
reset role;
do $$ declare ok boolean:=false; begin begin insert into public.engenharia_variaveis_preset(empresa_id,tipologia_id,produto_id,nome,valores,padrao,criado_por_id,criado_por_nome) select empresa_b,p.tipologia_id,produto_a,'cross-tenant','{}'::jsonb,false,u,'teste' from p0_ctx c join public.engenharia_variaveis_preset p on p.id=c.preset; exception when others then if sqlerrm like '%Produto do preset pertence a outra empresa%' or sqlerrm like '%Criador do preset pertence a outra empresa%' then ok:=true; else raise; end if; end; if not ok then raise exception 'Guard não bloqueou preset cross-tenant'; end if; end $$;
rollback;
select 'P0_ENGENHARIA_PRESET_TENANT_OK' as resultado;
