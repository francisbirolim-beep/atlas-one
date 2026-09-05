begin;

create temp table revisao_venda_ctx as
select
  (select id from public.usuarios where empresa_id is not null order by created_at limit 1) as usuario_id,
  (select id from public.vendas_obras where empresa_id is not null order by created_at limit 1) as venda_id,
  null::uuid as empresa_original,
  null::uuid as empresa_b,
  false as leu_propria,
  false as bloqueou_cross_tenant,
  false as bloqueou_usuario_forjado;

update revisao_venda_ctx c
set empresa_original=u.empresa_id
from public.usuarios u
where u.id=c.usuario_id;

do $$
begin
  if (select usuario_id is null or venda_id is null or empresa_original is null from revisao_venda_ctx) then
    raise exception 'Teste revisão de venda requer usuário e venda existentes';
  end if;
end $$;

select set_config('request.jwt.claim.sub',(select usuario_id::text from revisao_venda_ctx),true);

do $$
declare v_id uuid; v_estado jsonb;
begin
  select venda_id into v_id from revisao_venda_ctx;
  select public.fn_venda_estado_atual_v1(v_id) into v_estado;
  if v_estado is null then raise exception 'Usuário não conseguiu ler venda da própria empresa'; end if;
  update revisao_venda_ctx set leu_propria=true;
end $$;

-- Identidade informada pelo cliente não pode divergir do auth.uid().
do $$
declare v_id uuid;
begin
  select venda_id into v_id from revisao_venda_ctx;
  begin
    perform public.fn_registrar_revisao_venda_v1(v_id,'Teste segurança','{}'::jsonb,null,null,gen_random_uuid(),'forjado');
    raise exception 'Revisão aceitou usuário forjado';
  exception
    when others then
      if sqlerrm='Revisão aceitou usuário forjado' then raise; end if;
      if position('Usuário autenticado inválido' in sqlerrm)=0 then raise; end if;
      update revisao_venda_ctx set bloqueou_usuario_forjado=true;
  end;
end $$;

insert into public.empresas(nome,slug) values('Tenant Revisão Venda CI','tenant-revisao-venda-ci');
update revisao_venda_ctx set empresa_b=(select id from public.empresas where slug='tenant-revisao-venda-ci');
update public.usuarios set empresa_id=(select empresa_b from revisao_venda_ctx) where id=(select usuario_id from revisao_venda_ctx);

do $$
declare v_id uuid; v_estado jsonb;
begin
  select venda_id into v_id from revisao_venda_ctx;
  select public.fn_venda_estado_atual_v1(v_id) into v_estado;
  if v_estado is not null then raise exception 'Estado da venda vazou entre empresas'; end if;
  update revisao_venda_ctx set bloqueou_cross_tenant=true;
end $$;

do $$
begin
  if not (select leu_propria and bloqueou_cross_tenant and bloqueou_usuario_forjado from revisao_venda_ctx) then
    raise exception 'Proteções de revisão da venda não foram comprovadas';
  end if;
end $$;

rollback;
