do $$
declare v_count integer;
begin
  select count(*) into v_count
  from information_schema.columns
  where table_schema='public'
    and column_name='empresa_id'
    and is_nullable='YES'
    and table_name not in ('cadastro_historico','backups');
  if v_count <> 0 then
    raise exception 'P0 regression: % tabelas tenant ainda aceitam empresa_id NULL',v_count;
  end if;

  if has_table_privilege('authenticated','public.backups','SELECT')
     or has_table_privilege('authenticated','public.backups','INSERT')
     or not has_table_privilege('service_role','public.backups','SELECT') then
    raise exception 'P0 regression: privilegios backend-only de backups foram alterados';
  end if;

  raise notice 'P0_TENANT_NOT_NULL_SCHEMA_OK';
end $$;
