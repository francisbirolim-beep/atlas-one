do $$
declare v_count integer;
begin
  select count(*) into v_count
  from information_schema.columns
  where table_schema='public'
    and column_name='empresa_id'
    and is_nullable='YES'
    and table_name <> 'cadastro_historico';
  if v_count <> 0 then
    raise exception 'P0 regression: % tabelas tenant ainda aceitam empresa_id NULL',v_count;
  end if;
  raise notice 'P0_TENANT_NOT_NULL_SCHEMA_OK';
end $$;
