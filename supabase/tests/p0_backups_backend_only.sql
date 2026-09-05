do $$
declare
  v_policies integer;
begin
  select count(*) into v_policies
  from pg_policies
  where schemaname='public'
    and tablename='backups'
    and ('authenticated'=any(roles) or 'public'=any(roles));

  if v_policies <> 0 then
    raise exception 'P0 backup regression: tabela backups ainda possui policy exposta a authenticated/public';
  end if;

  if has_table_privilege('authenticated', 'public.backups', 'SELECT')
     or has_table_privilege('authenticated', 'public.backups', 'INSERT')
     or has_table_privilege('authenticated', 'public.backups', 'UPDATE')
     or has_table_privilege('authenticated', 'public.backups', 'DELETE') then
    raise exception 'P0 backup regression: authenticated ainda possui privilegio direto na tabela backups';
  end if;
end $$;
