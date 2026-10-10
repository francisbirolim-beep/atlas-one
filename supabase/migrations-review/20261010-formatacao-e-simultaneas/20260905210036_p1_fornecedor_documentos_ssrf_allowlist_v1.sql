alter table public.fornecedor_documentos
  drop constraint if exists fornecedor_documentos_url_storage_allowlist;

alter table public.fornecedor_documentos
  add constraint fornecedor_documentos_url_storage_allowlist
  check (
    url is null
    or btrim(url) = ''
    or url ~ '^https://urtqbvjpwnrfaayolymt\.supabase\.co/storage/v1/object/public/fotos/[A-Za-z0-9._~!$&''()*+,;=:@%/-]+$'
  );
