begin;

do $$
declare
  v_public boolean;
  v_limit bigint;
  v_mimes text[];
begin
  select public, file_size_limit, allowed_mime_types
    into v_public, v_limit, v_mimes
  from storage.buckets
  where id = 'atlas-interno';

  if not found then
    raise exception 'Bucket atlas-interno não existe';
  end if;
  if coalesce(v_public, true) then
    raise exception 'Bucket atlas-interno não pode ser público';
  end if;
  if v_limit is distinct from 15728640 then
    raise exception 'Limite do bucket atlas-interno deve ser 15 MB';
  end if;
  if not ('application/pdf' = any(v_mimes)) then
    raise exception 'Bucket atlas-interno deve aceitar application/pdf';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') ilike '%atlas-interno%'
        or coalesce(with_check, '') ilike '%atlas-interno%'
      )
      and roles && array['anon','authenticated','public']::name[]
  ) then
    raise exception 'Bucket atlas-interno não deve ter policy direta para cliente';
  end if;
end $$;

rollback;
