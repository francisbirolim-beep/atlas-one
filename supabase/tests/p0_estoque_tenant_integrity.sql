begin;

insert into public.empresas(nome,slug) values ('Tenant Estoque CI','tenant-estoque-ci');

insert into public.produtos(nome,categoria,preco,empresa_id)
values ('__PRODUTO_TENANT_CI__','outro',0,(select id from public.empresas where slug='tenant-estoque-ci'));

insert into public.unidades_operacionais(codigo,nome,tipo,empresa_id)
values ('TTCI','Tenant Teste CI','deposito',(select id from public.empresas where slug='tenant-estoque-ci'));

insert into public.estoque_locais(unidade_id,codigo,nome,tipo,empresa_id)
select id,'GERAL-CI','Geral CI','geral',empresa_id from public.unidades_operacionais where codigo='TTCI';

insert into public.estoque_saldos(produto_id,local_id,quantidade)
select p.id,l.id,10 from public.produtos p cross join public.estoque_locais l
where p.nome='__PRODUTO_TENANT_CI__' and l.codigo='GERAL-CI';

insert into public.estoque_reservas(produto_id,local_id,quantidade,status,origem_tipo)
select p.id,l.id,1,'ativa','teste_ci' from public.produtos p cross join public.estoque_locais l
where p.nome='__PRODUTO_TENANT_CI__' and l.codigo='GERAL-CI';

insert into public.estoque_movimentos(produto_id,tipo,quantidade,origem_tipo,local_origem_id)
select p.id,'saida',1,'teste_ci',l.id from public.produtos p cross join public.estoque_locais l
where p.nome='__PRODUTO_TENANT_CI__' and l.codigo='GERAL-CI';

do $$
declare e uuid; s uuid; r uuid; m uuid;
begin
  select id into e from public.empresas where slug='tenant-estoque-ci';
  select empresa_id into s from public.estoque_saldos where produto_id=(select id from public.produtos where nome='__PRODUTO_TENANT_CI__') limit 1;
  select empresa_id into r from public.estoque_reservas where produto_id=(select id from public.produtos where nome='__PRODUTO_TENANT_CI__') limit 1;
  select empresa_id into m from public.estoque_movimentos where produto_id=(select id from public.produtos where nome='__PRODUTO_TENANT_CI__') limit 1;
  if s is distinct from e then raise exception 'Saldo não herdou empresa correta'; end if;
  if r is distinct from e then raise exception 'Reserva não herdou empresa correta'; end if;
  if m is distinct from e then raise exception 'Movimento não herdou empresa correta'; end if;
end $$;

rollback;
