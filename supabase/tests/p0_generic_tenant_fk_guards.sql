do $$
declare
  v_expected integer;
  v_installed integer;
begin
  select count(*) into v_expected
  from pg_constraint con
  join pg_class child on child.oid=con.conrelid
  join pg_namespace cn on cn.oid=child.relnamespace
  join pg_class parent on parent.oid=con.confrelid
  join pg_namespace pn on pn.oid=parent.relnamespace
  join lateral unnest(con.conkey,con.confkey) with ordinality u(catt,patt,ord) on true
  join pg_attribute ca on ca.attrelid=child.oid and ca.attnum=u.catt
  join pg_attribute pa on pa.attrelid=parent.oid and pa.attnum=u.patt
  where con.contype='f'
    and array_length(con.conkey,1)=1
    and cn.nspname='public' and pn.nspname='public'
    and ca.attname<>'empresa_id'
    and format_type(pa.atttypid,pa.atttypmod)='uuid'
    and exists(select 1 from information_schema.columns x where x.table_schema='public' and x.table_name=child.relname and x.column_name='empresa_id' and x.is_nullable='NO')
    and exists(select 1 from information_schema.columns x where x.table_schema='public' and x.table_name=parent.relname and x.column_name='empresa_id' and x.is_nullable='NO');

  select count(*) into v_installed
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal and t.tgname like 'trg_tenant_fk_%';

  if v_expected <> v_installed then
    raise exception 'P0 tenant FK guards incompletos: esperado %, instalado %',v_expected,v_installed;
  end if;
  if has_function_privilege('authenticated','private.tenant_fk_same_empresa_guard()','EXECUTE') then
    raise exception 'P0 tenant FK guard exposto a authenticated';
  end if;
  raise notice 'P0_GENERIC_TENANT_FK_GUARD_OK: % relações protegidas',v_installed;
end $$;
