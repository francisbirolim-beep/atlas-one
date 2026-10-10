create or replace function public.is_master_atlas()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and role = 'master'
  );
$$;

revoke execute on function public.is_master_atlas() from public, anon;
grant execute on function public.is_master_atlas() to authenticated, service_role;

create table if not exists public.usuario_cadastros_360_permissoes (
  usuario_id uuid primary key references public.usuarios(id) on delete cascade,
  config jsonb not null default '{"visiveis":[],"acoes":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.usuario_cadastros_360_permissoes enable row level security;
revoke all on table public.usuario_cadastros_360_permissoes from anon;
grant select, insert, update, delete on table public.usuario_cadastros_360_permissoes to authenticated;
grant all on table public.usuario_cadastros_360_permissoes to service_role;

drop policy if exists usuario_cadastros_360_select on public.usuario_cadastros_360_permissoes;
create policy usuario_cadastros_360_select
on public.usuario_cadastros_360_permissoes for select to authenticated
using (usuario_id = auth.uid() or public.is_master_atlas());

drop policy if exists usuario_cadastros_360_insert on public.usuario_cadastros_360_permissoes;
create policy usuario_cadastros_360_insert
on public.usuario_cadastros_360_permissoes for insert to authenticated
with check (public.is_master_atlas());

drop policy if exists usuario_cadastros_360_update on public.usuario_cadastros_360_permissoes;
create policy usuario_cadastros_360_update
on public.usuario_cadastros_360_permissoes for update to authenticated
using (public.is_master_atlas()) with check (public.is_master_atlas());

drop policy if exists usuario_cadastros_360_delete on public.usuario_cadastros_360_permissoes;
create policy usuario_cadastros_360_delete
on public.usuario_cadastros_360_permissoes for delete to authenticated
using (public.is_master_atlas());

insert into public.usuario_cadastros_360_permissoes (usuario_id, config)
select replace(chave, 'cadastros_360_usuario:', '')::uuid, valor::jsonb
from public.configuracoes_gerais
where chave like 'cadastros_360_usuario:%'
on conflict (usuario_id) do nothing;
