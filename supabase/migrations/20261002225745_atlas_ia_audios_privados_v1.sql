insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'atlas-ia-audios',
  'atlas-ia-audios',
  false,
  20971520,
  array['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/aac','audio/wav','audio/x-wav']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
