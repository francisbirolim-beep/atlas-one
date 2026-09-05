create temporary table _tenant_policy_plan as
select p.tablename,
       bool_or(p.cmd in ('ALL','SELECT')) as sel,
       bool_or(p.cmd in ('ALL','INSERT')) as ins,
       bool_or(p.cmd in ('ALL','UPDATE')) as upd,
       bool_or(p.cmd in ('ALL','DELETE')) as del
from pg_policies p
join information_schema.columns c
  on c.table_schema='public' and c.table_name=p.tablename and c.column_name='empresa_id'
where p.schemaname='public'
  and (coalesce(p.qual,'') in ('true','(true)') or coalesce(p.with_check,'') in ('true','(true)'))
group by p.tablename;

do $$
declare r record;
begin
  for r in
    select p.tablename, p.policyname
    from pg_policies p
    join _tenant_policy_plan x on x.tablename=p.tablename
    where p.schemaname='public'
      and (coalesce(p.qual,'') in ('true','(true)') or coalesce(p.with_check,'') in ('true','(true)'))
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;

  for r in select * from _tenant_policy_plan loop
    if r.sel then
      execute format('create policy %I on public.%I for select to authenticated using (empresa_id = (select private.current_empresa_id()))', 'tenant_'||r.tablename||'_select', r.tablename);
    end if;
    if r.ins then
      execute format('create policy %I on public.%I for insert to authenticated with check (empresa_id = (select private.current_empresa_id()))', 'tenant_'||r.tablename||'_insert', r.tablename);
    end if;
    if r.upd then
      execute format('create policy %I on public.%I for update to authenticated using (empresa_id = (select private.current_empresa_id())) with check (empresa_id = (select private.current_empresa_id()))', 'tenant_'||r.tablename||'_update', r.tablename);
    end if;
    if r.del then
      execute format('create policy %I on public.%I for delete to authenticated using (empresa_id = (select private.current_empresa_id()))', 'tenant_'||r.tablename||'_delete', r.tablename);
    end if;
  end loop;
end $$;
