create or replace function private.is_bootstrap_platform_admin()
returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.usuarios u join public.empresas e on e.id=u.empresa_id where u.id=auth.uid() and u.role='master' and e.ativo=true and lower(e.slug)='esquadrifacio');
$$;
revoke all on function private.is_bootstrap_platform_admin() from public,anon;
grant execute on function private.is_bootstrap_platform_admin() to authenticated,service_role;

drop policy if exists acesso_total_temporario on public.setores;
drop policy if exists setores_select on public.setores;
drop policy if exists setores_insert on public.setores;
drop policy if exists setores_update on public.setores;
drop policy if exists setores_delete on public.setores;
create policy setores_select on public.setores for select to authenticated using (true);
create policy setores_insert on public.setores for insert to authenticated with check (private.is_bootstrap_platform_admin());
create policy setores_update on public.setores for update to authenticated using (private.is_bootstrap_platform_admin()) with check (private.is_bootstrap_platform_admin());
create policy setores_delete on public.setores for delete to authenticated using (private.is_bootstrap_platform_admin());
