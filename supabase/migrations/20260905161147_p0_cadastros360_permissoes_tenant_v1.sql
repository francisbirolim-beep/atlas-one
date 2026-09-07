alter table public.usuario_cadastros_360_permissoes alter column empresa_id set not null;

create or replace function private.is_master_atlas()
returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.usuarios u where u.id=auth.uid() and u.empresa_id=private.current_empresa_id() and u.role='master');
$$;
revoke all on function private.is_master_atlas() from public,anon;
grant execute on function private.is_master_atlas() to authenticated,service_role;

drop policy if exists usuario_cadastros_360_select on public.usuario_cadastros_360_permissoes;
drop policy if exists usuario_cadastros_360_insert on public.usuario_cadastros_360_permissoes;
drop policy if exists usuario_cadastros_360_update on public.usuario_cadastros_360_permissoes;
drop policy if exists usuario_cadastros_360_delete on public.usuario_cadastros_360_permissoes;
create policy usuario_cadastros_360_select on public.usuario_cadastros_360_permissoes for select to authenticated using (empresa_id=private.current_empresa_id() and (usuario_id=auth.uid() or private.is_master_atlas()));
create policy usuario_cadastros_360_insert on public.usuario_cadastros_360_permissoes for insert to authenticated with check (empresa_id=private.current_empresa_id() and private.is_master_atlas() and exists(select 1 from public.usuarios u where u.id=usuario_id and u.empresa_id=private.current_empresa_id()));
create policy usuario_cadastros_360_update on public.usuario_cadastros_360_permissoes for update to authenticated using (empresa_id=private.current_empresa_id() and private.is_master_atlas()) with check (empresa_id=private.current_empresa_id() and private.is_master_atlas() and exists(select 1 from public.usuarios u where u.id=usuario_id and u.empresa_id=private.current_empresa_id()));
create policy usuario_cadastros_360_delete on public.usuario_cadastros_360_permissoes for delete to authenticated using (empresa_id=private.current_empresa_id() and private.is_master_atlas());
drop function if exists public.is_master_atlas();
