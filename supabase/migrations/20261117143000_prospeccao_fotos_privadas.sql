-- Fotos privadas das visitas de prospecção.
-- Isoladas por prospecção e pelas RLS existentes de empresa/responsável.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prospeccao-fotos', 'prospeccao-fotos', false, 15728640,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif']::text[])
on conflict (id) do update
set public=false, file_size_limit=15728640,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists prospeccao_fotos_select on storage.objects;
create policy prospeccao_fotos_select on storage.objects
for select to authenticated
using (
  bucket_id='prospeccao-fotos'
  and exists (
    select 1 from public.prospeccoes p
    where p.id::text = (storage.foldername(name))[1]
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id=(select auth.uid()) or (select private.is_master_atlas()))
  )
);

drop policy if exists prospeccao_fotos_insert on storage.objects;
create policy prospeccao_fotos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='prospeccao-fotos'
  and exists (
    select 1 from public.prospeccoes p
    where p.id::text = (storage.foldername(name))[1]
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id=(select auth.uid()) or (select private.is_master_atlas()))
  )
);

drop policy if exists prospeccao_fotos_delete on storage.objects;
create policy prospeccao_fotos_delete on storage.objects
for delete to authenticated
using (
  bucket_id='prospeccao-fotos'
  and exists (
    select 1 from public.prospeccoes p
    where p.id::text = (storage.foldername(name))[1]
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id=(select auth.uid()) or (select private.is_master_atlas()))
  )
);

commit;
