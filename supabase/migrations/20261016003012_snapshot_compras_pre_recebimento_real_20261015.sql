begin;
create table if not exists private.atlas_compras_backup_antes_recebimento_20261015(
 tabela text not null,registro_id text not null,dados jsonb not null,
 salvo_em timestamptz not null default now(),primary key(tabela,registro_id));
revoke all on private.atlas_compras_backup_antes_recebimento_20261015 from public,anon,authenticated;
insert into private.atlas_compras_backup_antes_recebimento_20261015(tabela,registro_id,dados)
 select 'compras_solicitacoes',id::text,to_jsonb(t) from public.compras_solicitacoes t on conflict do nothing;
insert into private.atlas_compras_backup_antes_recebimento_20261015(tabela,registro_id,dados)
 select 'compras_solicitacao_itens',id::text,to_jsonb(t) from public.compras_solicitacao_itens t on conflict do nothing;
insert into private.atlas_compras_backup_antes_recebimento_20261015(tabela,registro_id,dados)
 select 'compras_carrinhos',id::text,to_jsonb(t) from public.compras_carrinhos t on conflict do nothing;
insert into private.atlas_compras_backup_antes_recebimento_20261015(tabela,registro_id,dados)
 select 'compras_carrinho_itens',id::text,to_jsonb(t) from public.compras_carrinho_itens t on conflict do nothing;
insert into private.atlas_compras_backup_antes_recebimento_20261015(tabela,registro_id,dados)
 select 'compras_recebimentos',id::text,to_jsonb(t) from public.compras_recebimentos t on conflict do nothing;
insert into private.atlas_compras_backup_antes_recebimento_20261015(tabela,registro_id,dados)
 select 'estoque_movimentos',id::text,to_jsonb(t) from public.estoque_movimentos t on conflict do nothing;
commit;