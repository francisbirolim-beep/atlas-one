do $$
declare r record;
begin
  for r in
    select c.relname as tabela
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind='r'
      and c.relrowsecurity
      and not exists (
        select 1 from pg_policies p
        where p.schemaname='public' and p.tablename=c.relname
      )
  loop
    execute format('revoke all privileges on table public.%I from anon, authenticated', r.tabela);
    execute format('grant all privileges on table public.%I to service_role', r.tabela);
  end loop;
end $$;
