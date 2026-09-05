begin;

create temp table rpc_tenant_ctx as
select
  (select id from public.usuarios where empresa_id is not null order by created_at limit 1) as usuario_id,
  (select id from public.orcamentos where empresa_id=(select id from public.empresas where slug='esquadrifacio') order by created_at limit 1) as orcamento_a,
  null::uuid as empresa_original,
  null::uuid as empresa_b,
  false as bloqueou_usuario_forjado,
  false as bloqueou_cross_tenant;

update rpc_tenant_ctx c
set empresa_original = u.empresa_id
from public.usuarios u
where u.id = c.usuario_id;

do $$
begin
  if (select usuario_id is null or orcamento_a is null or empresa_original is null from rpc_tenant_ctx) then
    raise exception 'Teste RPC requer usuário e orçamento existentes';
  end if;
end $$;

select set_config('request.jwt.claim.sub', (select usuario_id::text from rpc_tenant_ctx), true);

-- Um cliente não pode declarar outro p_usuario_id em RPC SECURITY DEFINER.
do $$
declare
  v_orc uuid;
begin
  select orcamento_a into v_orc from rpc_tenant_ctx;
  begin
    perform * from public.fn_iniciar_fluxo_venda_v2(v_orc, gen_random_uuid(), '__RPC_TEST__');
    raise exception 'RPC aceitou usuário forjado';
  exception
    when others then
      if sqlerrm = 'RPC aceitou usuário forjado' then raise; end if;
      if position('Usuário autenticado inválido' in sqlerrm) = 0 then raise; end if;
      update rpc_tenant_ctx set bloqueou_usuario_forjado=true;
  end;
end $$;

insert into public.empresas(nome,slug) values ('Tenant RPC CI','tenant-rpc-ci');
update rpc_tenant_ctx set empresa_b=(select id from public.empresas where slug='tenant-rpc-ci');
update public.usuarios
set empresa_id=(select empresa_b from rpc_tenant_ctx)
where id=(select usuario_id from rpc_tenant_ctx);

-- Mesmo autenticado corretamente, o usuário da Empresa B não pode operar orçamento da Empresa A.
do $$
declare
  v_orc uuid;
  v_user uuid;
begin
  select orcamento_a,usuario_id into v_orc,v_user from rpc_tenant_ctx;
  begin
    perform * from public.fn_iniciar_fluxo_venda_v2(v_orc, v_user, '__RPC_TEST__');
    raise exception 'RPC permitiu acesso cross-tenant';
  exception
    when others then
      if sqlerrm = 'RPC permitiu acesso cross-tenant' then raise; end if;
      if position('Orçamento não encontrado' in sqlerrm) = 0 then raise; end if;
      update rpc_tenant_ctx set bloqueou_cross_tenant=true;
  end;
end $$;

do $$
begin
  if not (select bloqueou_usuario_forjado and bloqueou_cross_tenant from rpc_tenant_ctx) then
    raise exception 'Proteções de identidade/tenant do RPC não foram comprovadas';
  end if;
end $$;

rollback;
