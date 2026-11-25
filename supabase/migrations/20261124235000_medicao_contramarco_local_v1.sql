-- Dados independentes da visita: nao modifica clientes, obras ou orcamentos.
create table if not exists public.medicao_contramarco_local (
  medicao_id uuid primary key references public.medicoes_finais(id) on delete restrict,
  empresa_id uuid not null references public.empresas(id),
  nome_obra text not null check (char_length(trim(nome_obra)) between 1 and 150),
  endereco text not null default '' check (char_length(endereco) <= 300),
  cidade text not null default '' check (char_length(cidade) <= 120),
  observacoes text not null default '' check (char_length(observacoes) <= 4000),
  gps text check (gps is null or char_length(gps) <= 40),
  atualizado_por uuid not null references public.usuarios(id),
  updated_at timestamptz not null default now()
);
create index if not exists medicao_contramarco_local_empresa_idx on public.medicao_contramarco_local(empresa_id);
create table if not exists public.medicao_contramarco_fotos (
  id uuid primary key default gen_random_uuid(),
  medicao_id uuid not null references public.medicoes_finais(id) on delete restrict,
  empresa_id uuid not null references public.empresas(id),
  arquivo_path text not null unique,
  arquivo_nome text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','image/heif')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  check (split_part(arquivo_path,'/',1) = empresa_id::text and split_part(arquivo_path,'/',2) = medicao_id::text)
);
create index if not exists medicao_contramarco_fotos_medicao_idx on public.medicao_contramarco_fotos(medicao_id,created_at);
alter table public.medicao_contramarco_local enable row level security;
alter table public.medicao_contramarco_fotos enable row level security;
revoke all on public.medicao_contramarco_local, public.medicao_contramarco_fotos from anon, authenticated;
grant select, insert, update, delete on public.medicao_contramarco_local, public.medicao_contramarco_fotos to service_role;
-- Somente o servidor autenticado acessa os registros e objetos privados.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('contramarco-obra-fotos','contramarco-obra-fotos',false,3145728,
 array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy contramarco_obra_fotos_somente_servidor on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'contramarco-obra-fotos')
with check (bucket_id <> 'contramarco-obra-fotos');

-- Segunda barreira de isolamento, além das verificações do servidor.
create or replace function public.guard_medicao_contramarco_local_v1() returns trigger
language plpgsql set search_path='' as $$
declare ator uuid;
begin
  if not exists (select 1 from public.medicoes_finais m where m.id=new.medicao_id and m.empresa_id=new.empresa_id and m.tipo_medicao='contramarco') then
    raise exception 'Medição de contramarco incompatível com a empresa';
  end if;
  if tg_table_name='medicao_contramarco_local' then ator:=new.atualizado_por; else ator:=new.criado_por; end if;
  if not exists(select 1 from public.usuarios u where u.id=ator and u.empresa_id=new.empresa_id) then
    raise exception 'Autor incompatível com a empresa';
  end if;
  return new;
end $$;
revoke all on function public.guard_medicao_contramarco_local_v1() from public, anon, authenticated;
create trigger guard_medicao_contramarco_local before insert or update on public.medicao_contramarco_local
for each row execute function public.guard_medicao_contramarco_local_v1();
create trigger guard_medicao_contramarco_fotos before insert or update on public.medicao_contramarco_fotos
for each row execute function public.guard_medicao_contramarco_local_v1();
