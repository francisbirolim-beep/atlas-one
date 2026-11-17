begin;

-- Faixa observada pelo vendedor; o CEP não garante limites de numeração.
alter table public.prospeccoes
  add column if not exists numero_inicial integer,
  add column if not exists numero_final integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospeccoes_faixa_numero_valida') then
    alter table public.prospeccoes
      add constraint prospeccoes_faixa_numero_valida check (
        (numero_inicial is null and numero_final is null)
        or (numero_inicial between 1 and 999999
            and (numero_final is null or numero_final between numero_inicial and 999999))
      );
  end if;
end;
$$;

-- As fotos de prospecção são privadas; ninguém acessa fotos de outra empresa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prospeccao-fotos', 'prospeccao-fotos', false, 6291456,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy prospeccao_fotos_select_20261117
on storage.objects for select to authenticated
using (
  bucket_id = 'prospeccao-fotos'
  and split_part(name, '/', 1) = (select private.current_empresa_id())::text
  and exists (
    select 1 from public.prospeccoes p
    where p.id::text = split_part(name, '/', 2)
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas()))
  )
);

create policy prospeccao_fotos_insert_20261117
on storage.objects for insert to authenticated
with check (
  bucket_id = 'prospeccao-fotos'
  and split_part(name, '/', 1) = (select private.current_empresa_id())::text
  and exists (
    select 1 from public.prospeccoes p
    where p.id::text = split_part(name, '/', 2)
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas()))
  )
);

commit;
