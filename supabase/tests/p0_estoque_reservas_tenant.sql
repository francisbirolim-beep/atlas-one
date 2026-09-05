begin;

create temp table reserva_tenant_ctx as
select
  (select id from public.usuarios where role <> 'master' and empresa_id is not null order by created_at limit 1) as user_b,
  null::uuid as empresa_a,
  null::uuid as empresa_b,
  null::uuid as produto_a,
  null::uuid as local_a,
  null::uuid as reserva_a,
  false as bloqueou_reserva_cross,
  false as bloqueou_cancelamento_cross;

do $$
begin
  if (select user_b is null from reserva_tenant_ctx) then
    raise exception 'Teste de reservas precisa de usuário não-master existente';
  end if;
end $$;

insert into public.empresas(nome,slug) values
  ('Tenant Reserva A CI','tenant-reserva-a-ci'),
  ('Tenant Reserva B CI','tenant-reserva-b-ci');

update reserva_tenant_ctx set
  empresa_a=(select id from public.empresas where slug='tenant-reserva-a-ci'),
  empresa_b=(select id from public.empresas where slug='tenant-reserva-b-ci');

update public.usuarios
set empresa_id=(select empresa_b from reserva_tenant_ctx)
where id=(select user_b from reserva_tenant_ctx);

insert into public.produtos(nome,categoria,preco,empresa_id)
values ('__PRODUTO_RESERVA_A_CI__','outro',0,(select empresa_a from reserva_tenant_ctx));

update reserva_tenant_ctx
set produto_a=(select id from public.produtos where nome='__PRODUTO_RESERVA_A_CI__' limit 1);

insert into public.unidades_operacionais(codigo,nome,tipo,empresa_id)
values ('TRA-CI','Tenant Reserva A','deposito',(select empresa_a from reserva_tenant_ctx));

insert into public.estoque_locais(unidade_id,codigo,nome,tipo,empresa_id)
select id,'GERAL-RA-CI','Geral Reserva A','geral',empresa_id
from public.unidades_operacionais where codigo='TRA-CI';

update reserva_tenant_ctx
set local_a=(select id from public.estoque_locais where codigo='GERAL-RA-CI' limit 1);

insert into public.estoque_saldos(produto_id,local_id,quantidade,quantidade_reservada,empresa_id)
select produto_a,local_a,10,1,empresa_a from reserva_tenant_ctx;

insert into public.estoque_reservas(produto_id,local_id,quantidade,status,origem_tipo,empresa_id)
select produto_a,local_a,1,'ativa','teste_ci',empresa_a from reserva_tenant_ctx;

update reserva_tenant_ctx
set reserva_a=(select id from public.estoque_reservas where origem_tipo='teste_ci' and empresa_id=empresa_a limit 1);

do $$
declare c reserva_tenant_ctx%rowtype;
begin
  select * into c from reserva_tenant_ctx;
  begin
    perform public.reservar_estoque_local(c.produto_a,c.local_a,1,'teste_cross',null,null,null,null,c.user_b,'Tenant B');
    raise exception 'Reserva cross-tenant não foi bloqueada';
  exception when others then
    if sqlerrm='Reserva cross-tenant não foi bloqueada' then raise; end if;
    update reserva_tenant_ctx set bloqueou_reserva_cross=true;
  end;
end $$;

do $$
declare c reserva_tenant_ctx%rowtype;
begin
  select * into c from reserva_tenant_ctx;
  begin
    perform public.cancelar_reserva_estoque(c.reserva_a,c.user_b,'Tenant B');
    raise exception 'Cancelamento cross-tenant não foi bloqueado';
  exception when others then
    if sqlerrm='Cancelamento cross-tenant não foi bloqueado' then raise; end if;
    update reserva_tenant_ctx set bloqueou_cancelamento_cross=true;
  end;
end $$;

do $$
begin
  if not (select bloqueou_reserva_cross and bloqueou_cancelamento_cross from reserva_tenant_ctx) then
    raise exception 'Proteção cross-tenant de reservas não foi comprovada';
  end if;
end $$;

rollback;
