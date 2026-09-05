create schema if not exists private;

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.empresas enable row level security;

insert into public.empresas (nome, slug)
select 'Esquadrifácio Soluções em Alumínio', 'esquadrifacio'
where not exists (select 1 from public.empresas where slug = 'esquadrifacio');

alter table public.usuarios add column if not exists empresa_id uuid references public.empresas(id);
alter table public.clientes add column if not exists empresa_id uuid references public.empresas(id);
alter table public.obras add column if not exists empresa_id uuid references public.empresas(id);
alter table public.orcamentos add column if not exists empresa_id uuid references public.empresas(id);
alter table public.produtos add column if not exists empresa_id uuid references public.empresas(id);
alter table public.fornecedores add column if not exists empresa_id uuid references public.empresas(id);
alter table public.unidades_operacionais add column if not exists empresa_id uuid references public.empresas(id);

update public.usuarios set empresa_id = (select id from public.empresas where slug='esquadrifacio') where empresa_id is null;
update public.clientes set empresa_id = (select id from public.empresas where slug='esquadrifacio') where empresa_id is null;
update public.obras set empresa_id = (select id from public.empresas where slug='esquadrifacio') where empresa_id is null;
update public.orcamentos set empresa_id = (select id from public.empresas where slug='esquadrifacio') where empresa_id is null;
update public.produtos set empresa_id = (select id from public.empresas where slug='esquadrifacio') where empresa_id is null;
update public.fornecedores set empresa_id = (select id from public.empresas where slug='esquadrifacio') where empresa_id is null;
update public.unidades_operacionais set empresa_id = (select id from public.empresas where slug='esquadrifacio') where empresa_id is null;

create index if not exists idx_usuarios_empresa_id on public.usuarios(empresa_id);
create index if not exists idx_clientes_empresa_id on public.clientes(empresa_id);
create index if not exists idx_obras_empresa_id on public.obras(empresa_id);
create index if not exists idx_orcamentos_empresa_id on public.orcamentos(empresa_id);
create index if not exists idx_produtos_empresa_id on public.produtos(empresa_id);
create index if not exists idx_fornecedores_empresa_id on public.fornecedores(empresa_id);
create index if not exists idx_unidades_operacionais_empresa_id on public.unidades_operacionais(empresa_id);

create or replace function private.current_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.empresa_id
  from public.usuarios u
  where u.id = (select auth.uid())
  limit 1
$$;

revoke all on function private.current_empresa_id() from public;
grant execute on function private.current_empresa_id() to authenticated;

alter table public.usuarios alter column empresa_id set default private.current_empresa_id();
alter table public.clientes alter column empresa_id set default private.current_empresa_id();
alter table public.obras alter column empresa_id set default private.current_empresa_id();
alter table public.orcamentos alter column empresa_id set default private.current_empresa_id();
alter table public.produtos alter column empresa_id set default private.current_empresa_id();
alter table public.fornecedores alter column empresa_id set default private.current_empresa_id();
alter table public.unidades_operacionais alter column empresa_id set default private.current_empresa_id();

drop policy if exists "empresa_select_propria" on public.empresas;
create policy "empresa_select_propria" on public.empresas for select to authenticated
using (id = (select private.current_empresa_id()));

drop policy if exists "acesso_total_temporario" on public.usuarios;
drop policy if exists "acesso_total_temporario" on public.clientes;
drop policy if exists "acesso_total_temporario" on public.orcamentos;
drop policy if exists "acesso_total_temporario" on public.produtos;
drop policy if exists "acesso_total_temporario" on public.fornecedores;
drop policy if exists "obras_select_total" on public.obras;
drop policy if exists "obras_insert_total" on public.obras;
drop policy if exists "obras_update_total" on public.obras;
drop policy if exists "obras_delete_total" on public.obras;

create policy "usuarios_select_empresa" on public.usuarios for select to authenticated using (empresa_id = (select private.current_empresa_id()));
create policy "usuarios_insert_empresa" on public.usuarios for insert to authenticated with check (empresa_id = (select private.current_empresa_id()));
create policy "usuarios_update_empresa" on public.usuarios for update to authenticated using (empresa_id = (select private.current_empresa_id())) with check (empresa_id = (select private.current_empresa_id()));
create policy "usuarios_delete_empresa" on public.usuarios for delete to authenticated using (empresa_id = (select private.current_empresa_id()));

create policy "clientes_select_empresa" on public.clientes for select to authenticated using (empresa_id = (select private.current_empresa_id()));
create policy "clientes_insert_empresa" on public.clientes for insert to authenticated with check (empresa_id = (select private.current_empresa_id()));
create policy "clientes_update_empresa" on public.clientes for update to authenticated using (empresa_id = (select private.current_empresa_id())) with check (empresa_id = (select private.current_empresa_id()));
create policy "clientes_delete_empresa" on public.clientes for delete to authenticated using (empresa_id = (select private.current_empresa_id()));

create policy "obras_select_empresa" on public.obras for select to authenticated using (empresa_id = (select private.current_empresa_id()));
create policy "obras_insert_empresa" on public.obras for insert to authenticated with check (empresa_id = (select private.current_empresa_id()));
create policy "obras_update_empresa" on public.obras for update to authenticated using (empresa_id = (select private.current_empresa_id())) with check (empresa_id = (select private.current_empresa_id()));
create policy "obras_delete_empresa" on public.obras for delete to authenticated using (empresa_id = (select private.current_empresa_id()));

create policy "orcamentos_select_empresa" on public.orcamentos for select to authenticated using (empresa_id = (select private.current_empresa_id()));
create policy "orcamentos_insert_empresa" on public.orcamentos for insert to authenticated with check (empresa_id = (select private.current_empresa_id()));
create policy "orcamentos_update_empresa" on public.orcamentos for update to authenticated using (empresa_id = (select private.current_empresa_id())) with check (empresa_id = (select private.current_empresa_id()));
create policy "orcamentos_delete_empresa" on public.orcamentos for delete to authenticated using (empresa_id = (select private.current_empresa_id()));

create policy "produtos_select_empresa" on public.produtos for select to authenticated using (empresa_id = (select private.current_empresa_id()));
create policy "produtos_insert_empresa" on public.produtos for insert to authenticated with check (empresa_id = (select private.current_empresa_id()));
create policy "produtos_update_empresa" on public.produtos for update to authenticated using (empresa_id = (select private.current_empresa_id())) with check (empresa_id = (select private.current_empresa_id()));
create policy "produtos_delete_empresa" on public.produtos for delete to authenticated using (empresa_id = (select private.current_empresa_id()));

create policy "fornecedores_select_empresa" on public.fornecedores for select to authenticated using (empresa_id = (select private.current_empresa_id()));
create policy "fornecedores_insert_empresa" on public.fornecedores for insert to authenticated with check (empresa_id = (select private.current_empresa_id()));
create policy "fornecedores_update_empresa" on public.fornecedores for update to authenticated using (empresa_id = (select private.current_empresa_id())) with check (empresa_id = (select private.current_empresa_id()));
create policy "fornecedores_delete_empresa" on public.fornecedores for delete to authenticated using (empresa_id = (select private.current_empresa_id()));

create policy "unidades_select_empresa" on public.unidades_operacionais for select to authenticated using (empresa_id = (select private.current_empresa_id()));
create policy "unidades_insert_empresa" on public.unidades_operacionais for insert to authenticated with check (empresa_id = (select private.current_empresa_id()));
create policy "unidades_update_empresa" on public.unidades_operacionais for update to authenticated using (empresa_id = (select private.current_empresa_id())) with check (empresa_id = (select private.current_empresa_id()));
create policy "unidades_delete_empresa" on public.unidades_operacionais for delete to authenticated using (empresa_id = (select private.current_empresa_id()));
