drop policy if exists tenant_backups_select on public.backups;
drop policy if exists tenant_backups_insert on public.backups;
drop policy if exists tenant_backups_update on public.backups;
drop policy if exists tenant_backups_delete on public.backups;

revoke all on table public.backups from anon;
revoke all on table public.backups from authenticated;

grant all on table public.backups to service_role;
