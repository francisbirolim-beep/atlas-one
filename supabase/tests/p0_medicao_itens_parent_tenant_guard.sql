do $$
declare
  v_trigger integer;
begin
  select count(*) into v_trigger
  from pg_trigger t
  join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='medicao_itens'
    and t.tgname='trg_medicao_item_empresa_guard' and not t.tgisinternal;
  if v_trigger <> 1 then
    raise exception 'P0 Medicao: guard tenant de medicao_itens ausente';
  end if;
  raise notice 'P0_MEDICAO_ITEM_PARENT_TENANT_OK';
end $$;
