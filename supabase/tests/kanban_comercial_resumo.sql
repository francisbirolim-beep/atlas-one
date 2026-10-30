-- Read-only regression assertions. Run in a transaction and roll back.
begin;
do $test$
declare
  u record;
  original_count bigint;
  resumo_count bigint;
  foreign_count bigint;
  empresas_testadas int := 0;
begin
  if not exists (select 1 from pg_class where oid='public.orcamentos_kanban_resumo'::regclass and reloptions @> array['security_invoker=true']) then
    raise exception 'Resumo precisa obedecer RLS do chamador';
  end if;
  if has_table_privilege('anon','public.orcamentos_kanban_resumo','select')
     or has_table_privilege('authenticated','public.orcamentos_kanban_resumo','insert')
     or has_table_privilege('authenticated','public.orcamentos_kanban_resumo','update')
     or has_table_privilege('authenticated','public.orcamentos_kanban_resumo','delete') then
    raise exception 'Resumo permite acesso indevido ou escrita';
  end if;
  if exists (
    select 1 from public.orcamentos o full join public.orcamentos_kanban_resumo r using(id)
    where o.id is null or r.id is null
       or (to_jsonb(o)-array['itens','wvetro_fluxo']) is distinct from (to_jsonb(r)-array['itens','wvetro_fluxo'])
       or (o.wvetro_fluxo-'payload_bruto') is distinct from r.wvetro_fluxo
       or jsonb_array_length(coalesce(o.itens,'[]')) <> jsonb_array_length(coalesce(r.itens,'[]'))
  ) then raise exception 'Resumo alterou dados, cards ou quantidades'; end if;
  if exists (
    select 1 from public.orcamentos o join public.orcamentos_kanban_resumo r using(id)
    cross join lateral jsonb_array_elements(coalesce(o.itens,'[]')) with ordinality x(item,pos)
    where (x.item-array['wvetro_item','wvetro_composicao','referencia_wvetro']) is distinct from r.itens->(x.pos::int-1)
  ) then raise exception 'Resumo alterou campo técnico ou ordem de esquadria'; end if;
  for u in select distinct on (empresa_id) id,empresa_id from public.usuarios where empresa_id is not null loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub',u.id,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    select count(*) into original_count from public.orcamentos;
    select count(*),count(*) filter(where empresa_id <> u.empresa_id) into resumo_count,foreign_count from public.orcamentos_kanban_resumo;
    execute 'reset role';
    if original_count <> resumo_count or foreign_count <> 0 then raise exception 'Isolamento ou quantidade divergente'; end if;
    empresas_testadas := empresas_testadas+1;
  end loop;
  if empresas_testadas=0 then raise exception 'Nenhuma empresa disponível para testar'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  execute 'set local role authenticated';
  select count(*) into resumo_count from public.orcamentos_kanban_resumo;
  execute 'reset role';
  if resumo_count <> 0 then raise exception 'Usuário sem empresa recebeu registros'; end if;
end $test$;
rollback;
