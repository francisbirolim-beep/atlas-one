do $$
declare v_count integer;
begin
  select count(*) into v_count
  from pg_constraint
  where conrelid='public.fornecedor_documentos'::regclass
    and conname='fornecedor_documentos_url_storage_allowlist';
  if v_count <> 1 then
    raise exception 'P1 regression: allowlist SSRF ausente em fornecedor_documentos';
  end if;
  raise notice 'P1_FORNECEDOR_SSRF_ALLOWLIST_OK';
end $$;
