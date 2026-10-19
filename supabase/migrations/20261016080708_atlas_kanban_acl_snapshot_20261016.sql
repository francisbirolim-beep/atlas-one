begin;
create table if not exists private.atlas_kanban_acl_snapshot_20261016 (
 item text primary key, valor text not null, salvo_em timestamptz not null default now()
);
revoke all on private.atlas_kanban_acl_snapshot_20261016 from public,anon,authenticated;
insert into private.atlas_kanban_acl_snapshot_20261016(item,valor)
select 'salvar_kanban_layout_visual_v1',pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='salvar_kanban_layout_visual_v1'
on conflict (item) do nothing;
commit;