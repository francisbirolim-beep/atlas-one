insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-anexos','chat-anexos',true,52428800,array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','audio/webm','audio/mp4','audio/mpeg','audio/ogg','application/pdf'])
on conflict(id) do update set public=true,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "chat_anexos_insert" on storage.objects;
create policy "chat_anexos_insert" on storage.objects for insert to authenticated
with check (bucket_id='chat-anexos' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "chat_anexos_select" on storage.objects;
create policy "chat_anexos_select" on storage.objects for select to authenticated
using (bucket_id='chat-anexos');

drop policy if exists "chat_anexos_delete" on storage.objects;
create policy "chat_anexos_delete" on storage.objects for delete to authenticated
using (bucket_id='chat-anexos' and owner_id=auth.uid()::text);
