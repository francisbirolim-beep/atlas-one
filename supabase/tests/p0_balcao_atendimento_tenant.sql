begin;
create temporary table p0_ctx(master_id uuid,item_id uuid,empresa_a uuid) on commit drop;
insert into p0_ctx
select u.id,i.id,u.empresa_id
from public.usuarios u cross join lateral (select id from public.balcao_venda_itens where empresa_id=u.empresa_id limit 1) i
where u.role='master' limit 1;
create temporary table p0_b(empresa_b uuid) on commit drop;
insert into p0_b values(gen_random_uuid());
insert into public.empresas(id,nome,slug,ativo) select empresa_b,'P0 Empresa B','p0-balcao-atendimento-'||substr(empresa_b::text,1,8),true from p0_b;
update public.usuarios set empresa_id=(select empresa_b from p0_b) where id=(select master_id from p0_ctx);
do $$ declare ok boolean:=false; begin
  begin
    perform public.avancar_atendimento_venda_balcao((select item_id from p0_ctx),'entregar',(select master_id from p0_ctx),'forjado',null);
  exception when others then
    if sqlerrm like '%não encontrado para esta empresa%' then ok:=true; else raise; end if;
  end;
  if not ok then raise exception 'Falha no isolamento do atendimento Balcão'; end if;
end $$;
rollback;

begin;
do $$ declare v_u uuid; v_item uuid; ok boolean:=false; begin
  select u.id,i.id into v_u,v_item
  from public.usuarios u cross join lateral (select id from public.balcao_venda_itens where empresa_id=u.empresa_id limit 1) i
  where u.role='master' limit 1;
  if v_u is null or v_item is null then raise exception 'Sem dados para teste de compatibilidade'; end if;
  begin
    perform public.avancar_atendimento_venda_balcao(v_item,'acao_invalida',v_u,'nome forjado',null);
  exception when others then
    if sqlerrm like '%Ação de atendimento inválida%' then ok:=true; else raise; end if;
  end;
  if not ok then raise exception 'Gate legítimo não chegou à implementação'; end if;
end $$;
rollback;
select 'P0_BALCAO_ATENDIMENTO_TENANT_OK' as tenant, 'P0_BALCAO_ATENDIMENTO_COMPAT_OK' as compat;
