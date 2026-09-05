do $$
declare
  v_oid oid;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='finalizar_venda_balcao';

  if v_oid is null then raise exception 'P0 Balcao: wrapper ausente'; end if;
  if position('set_config(''request.jwt.claim.sub''' in pg_get_functiondef(v_oid)) = 0 then
    raise exception 'P0 Balcao: contexto tenant ausente';
  end if;
  if has_function_privilege('authenticated',v_oid,'EXECUTE') or has_function_privilege('anon',v_oid,'EXECUTE') then
    raise exception 'P0 Balcao: RPC privilegiado exposto ao cliente';
  end if;
  if not has_function_privilege('service_role',v_oid,'EXECUTE') then
    raise exception 'P0 Balcao: service_role sem execute';
  end if;
  raise notice 'P0_BALCAO_SERVICE_ROLE_CONTEXT_OK';
end $$;
