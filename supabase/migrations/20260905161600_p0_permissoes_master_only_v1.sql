alter table public.permissoes alter column empresa_id set not null;

drop policy if exists tenant_permissoes_select on public.permissoes;
drop policy if exists tenant_permissoes_insert on public.permissoes;
drop policy if exists tenant_permissoes_update on public.permissoes;
drop policy if exists tenant_permissoes_delete on public.permissoes;

create policy tenant_permissoes_select on public.permissoes for select to authenticated using (empresa_id=private.current_empresa_id() and (usuario_id=auth.uid() or private.is_master_atlas()));
create policy tenant_permissoes_insert on public.permissoes for insert to authenticated with check (empresa_id=private.current_empresa_id() and private.is_master_atlas() and exists(select 1 from public.usuarios u where u.id=usuario_id and u.empresa_id=private.current_empresa_id()));
create policy tenant_permissoes_update on public.permissoes for update to authenticated using (empresa_id=private.current_empresa_id() and private.is_master_atlas()) with check (empresa_id=private.current_empresa_id() and private.is_master_atlas() and exists(select 1 from public.usuarios u where u.id=usuario_id and u.empresa_id=private.current_empresa_id()));
create policy tenant_permissoes_delete on public.permissoes for delete to authenticated using (empresa_id=private.current_empresa_id() and private.is_master_atlas());
