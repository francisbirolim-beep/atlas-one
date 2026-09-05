insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('atlas-interno', 'atlas-interno', false, 15728640, array['application/pdf']::text[])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Bucket deliberadamente sem policies para anon/authenticated.
-- Acesso operacional ocorre somente em rotas server-side autenticadas,
-- que validam o tenant antes de usar a credencial administrativa.
