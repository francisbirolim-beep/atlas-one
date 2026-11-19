create table if not exists public.prospeccao_fotos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default private.current_empresa_id() references public.empresas(id),
  prospeccao_id uuid not null references public.prospeccoes(id) on delete cascade,
  arquivo_path text not null unique,
  arquivo_nome text not null check (length(trim(arquivo_nome)) > 0),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','image/heif')),
  enviado_por uuid not null default auth.uid() references public.usuarios(id),
  created_at timestamptz not null default now(),
  constraint prospeccao_fotos_caminho_valido check (
    split_part(arquivo_path, '/', 1) = empresa_id::text
    and split_part(arquivo_path, '/', 2) = prospeccao_id::text
  )
);

create index if not exists prospeccao_fotos_prospeccao_data_idx
  on public.prospeccao_fotos(prospeccao_id, created_at desc);

alter table public.prospeccao_fotos enable row level security;
revoke all on public.prospeccao_fotos from anon, authenticated;
grant select, insert, delete on public.prospeccao_fotos to authenticated;

create policy prospeccao_fotos_select on public.prospeccao_fotos
for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and exists (
    select 1 from public.prospeccoes p
    where p.id = prospeccao_id and p.empresa_id = empresa_id
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas()))
  )
);

create policy prospeccao_fotos_insert on public.prospeccao_fotos
for insert to authenticated
with check (
  empresa_id = (select private.current_empresa_id())
  and enviado_por = (select auth.uid())
  and exists (
    select 1 from public.prospeccoes p
    where p.id = prospeccao_id and p.empresa_id = empresa_id
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas()))
  )
);

create policy prospeccao_fotos_delete on public.prospeccao_fotos
for delete to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (enviado_por = (select auth.uid()) or (select private.is_master_atlas()))
  and exists (
    select 1 from public.prospeccoes p
    where p.id = prospeccao_id and p.empresa_id = empresa_id
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas()))
  )
);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('prospeccao-fotos', 'prospeccao-fotos', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict(id) do nothing;

create policy prospeccao_fotos_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'prospeccao-fotos'
  and (storage.foldername(name))[1] = (select private.current_empresa_id())::text
  and exists (
    select 1 from public.prospeccoes p
    where p.id::text = (storage.foldername(name))[2]
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas()))
  )
);

create policy prospeccao_fotos_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'prospeccao-fotos'
  and (storage.foldername(name))[1] = (select private.current_empresa_id())::text
  and exists (
    select 1 from public.prospeccoes p
    where p.id::text = (storage.foldername(name))[2]
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas()))
  )
);

create policy prospeccao_fotos_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'prospeccao-fotos'
  and (storage.foldername(name))[1] = (select private.current_empresa_id())::text
  and (owner_id = (select auth.uid())::text or (select private.is_master_atlas()))
  and exists (
    select 1 from public.prospeccoes p
    where p.id::text = (storage.foldername(name))[2]
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas()))
  )
);
