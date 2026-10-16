begin;
create table if not exists private.atlas_kanban_colunas_backup_20261016 (
 tabela text not null,registro_id text not null,dados jsonb not null,
 salvo_em timestamptz not null default now(), primary key(tabela,registro_id)
);
revoke all on private.atlas_kanban_colunas_backup_20261016 from public,anon,authenticated;
insert into private.atlas_kanban_colunas_backup_20261016(tabela,registro_id,dados)
 select 'central_kanban_colunas',id::text,to_jsonb(t) from public.central_kanban_colunas t on conflict do nothing;
insert into private.atlas_kanban_colunas_backup_20261016(tabela,registro_id,dados)
 select 'kanban_colunas',id::text,to_jsonb(t) from public.kanban_colunas t on conflict do nothing;
insert into private.atlas_kanban_colunas_backup_20261016(tabela,registro_id,dados)
 select 'setor_kanban_colunas',id::text,to_jsonb(t) from public.setor_kanban_colunas t on conflict do nothing;
commit;