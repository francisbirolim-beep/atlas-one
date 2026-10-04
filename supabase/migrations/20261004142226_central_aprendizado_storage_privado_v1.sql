drop policy if exists atlas_aprendizado_upload_autenticado on storage.objects;

create policy atlas_aprendizado_upload_autenticado
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'atlas-aprendizado'
  and (storage.foldername(name))[1] = 'ingest'
  and (storage.foldername(name))[2] = auth.uid()::text
);
