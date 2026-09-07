create or replace function private.tenant_fk_same_empresa_guard()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_fk uuid;
  v_parent_empresa uuid;
begin
  v_fk := nullif(to_jsonb(new)->>tg_argv[1], '')::uuid;
  if v_fk is null then return new; end if;

  execute format('select p.empresa_id from public.%I p where p.%I=$1', tg_argv[0], tg_argv[2])
    into v_parent_empresa
    using v_fk;

  if v_parent_empresa is null then return new; end if;

  if new.empresa_id is null then
    new.empresa_id := v_parent_empresa;
  elsif new.empresa_id is distinct from v_parent_empresa then
    raise exception 'TENANT_FK_GUARD: %.% referencia %.% de outra empresa (% x %)',
      tg_table_name, tg_argv[1], tg_argv[0], tg_argv[2], new.empresa_id, v_parent_empresa;
  end if;

  return new;
end;
$$;

revoke all on function private.tenant_fk_same_empresa_guard() from public, anon, authenticated;
grant execute on function private.tenant_fk_same_empresa_guard() to service_role;

do $$
declare
  r record;
  v_trigger text;
begin
  for r in
    select con.conname,
           child.relname child_table,
           parent.relname parent_table,
           ca.attname child_col,
           pa.attname parent_col
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
      and exists(select 1 from information_schema.columns x where x.table_schema='public' and x.table_name=parent.relname and x.column_name='empresa_id' and x.is_nullable='NO')
  loop
    v_trigger := 'trg_tenant_fk_' || substr(md5(r.child_table || ':' || r.conname),1,20);
    execute format('drop trigger if exists %I on public.%I', v_trigger, r.child_table);
    execute format(
      'create trigger %I before insert or update of empresa_id,%I on public.%I for each row execute function private.tenant_fk_same_empresa_guard(%L,%L,%L,%L)',
      v_trigger, r.child_col, r.child_table, r.parent_table, r.child_col, r.parent_col, r.conname
    );
  end loop;
end $$;
