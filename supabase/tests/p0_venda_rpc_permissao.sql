begin;
create temporary table p0_ctx(u uuid, empresa uuid) on commit drop;
insert into p0_ctx select id,empresa_id from public.usuarios where role='funcionario' limit 1;
delete from public.permissoes where usuario_id=(select u from p0_ctx) and setor_id='orcamentos';
do $$
declare v_u uuid; ok1 boolean:=false; ok2 boolean:=false; ok3 boolean:=false;
begin
 select u into v_u from p0_ctx;
 perform set_config('request.jwt.claim.sub',v_u::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 begin perform public.fn_venda_estado_atual_v1(gen_random_uuid()); exception when others then if sqlerrm like '%sem permissão de edição em Orçamentos%' then ok1:=true; else raise; end if; end;
 begin perform public.fn_registrar_revisao_venda_v1(gen_random_uuid(),'teste','{}'::jsonb,null,null,v_u,'teste'); exception when others then if sqlerrm like '%sem permissão de edição em Orçamentos%' then ok2:=true; else raise; end if; end;
 begin perform public.fn_iniciar_fluxo_venda_v2(gen_random_uuid(),v_u,'teste'); exception when others then if sqlerrm like '%sem permissão de edição em Orçamentos%' then ok3:=true; else raise; end if; end;
 if not(ok1 and ok2 and ok3) then raise exception 'Falha no gate de venda'; end if;
end $$;
rollback;
select 'P0_VENDA_PERMISSAO_OK' as resultado;
