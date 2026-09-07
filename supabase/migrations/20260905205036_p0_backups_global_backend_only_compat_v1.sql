alter table public.backups alter column empresa_id drop not null;

revoke all on table public.backups from anon, authenticated;
grant all on table public.backups to service_role;
