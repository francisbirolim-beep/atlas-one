do $$
declare v_count integer;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname='public'
    and cmd='ALL'
    and coalesce(qual,'')='true'
    and coalesce(with_check,'')='true';
  if v_count<>0 then raise exception 'Existem policies ALL true/true no schema public'; end if;
end $$;
select 'P0_POLICIES_PERMISSIVAS_ZERO_OK' resultado;
