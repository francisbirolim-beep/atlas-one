insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'whatsapp-midia',
  'whatsapp-midia',
  false,
  52428800,
  array[
    'image/jpeg','image/png','image/webp','image/heic',
    'video/mp4','video/quicktime',
    'audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/opus','audio/aac',
    'application/pdf','text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
