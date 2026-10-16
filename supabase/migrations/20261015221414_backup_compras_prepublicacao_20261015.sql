begin;
create table if not exists private.atlas_compras_snapshot_20261015 (
 origem text not null,registro_id text not null,dados jsonb not null,salvo_em timestamptz not null default now(),
 primary key(origem,registro_id)
);
revoke all on private.atlas_compras_snapshot_20261015 from public,anon,authenticated;
insert into private.atlas_compras_snapshot_20261015(origem,registro_id,dados)
 select 'compras_necessidades',id::text,to_jsonb(x) from public.compras_necessidades x on conflict do nothing;
insert into private.atlas_compras_snapshot_20261015(origem,registro_id,dados)
 select 'compras_cotacoes',id::text,to_jsonb(x) from public.compras_cotacoes x on conflict do nothing;
insert into private.atlas_compras_snapshot_20261015(origem,registro_id,dados)
 select 'compras_nfs',id::text,to_jsonb(x) from public.compras_nfs x on conflict do nothing;
insert into private.atlas_compras_snapshot_20261015(origem,registro_id,dados)
 select 'compras_nf_itens',id::text,to_jsonb(x) from public.compras_nf_itens x on conflict do nothing;
insert into private.atlas_compras_snapshot_20261015(origem,registro_id,dados)
 select 'compras_recebimentos',id::text,to_jsonb(x) from public.compras_recebimentos x on conflict do nothing;
insert into private.atlas_compras_snapshot_20261015(origem,registro_id,dados)
 select 'compras_recebimento_itens',id::text,to_jsonb(x) from public.compras_recebimento_itens x on conflict do nothing;
insert into private.atlas_compras_snapshot_20261015(origem,registro_id,dados)
 select 'fornecedores',id::text,to_jsonb(x) from public.fornecedores x on conflict do nothing;
insert into private.atlas_compras_snapshot_20261015(origem,registro_id,dados)
 select 'produto_fornecedores',id::text,to_jsonb(x) from public.produto_fornecedores x on conflict do nothing;
insert into private.atlas_compras_snapshot_20261015(origem,registro_id,dados)
 select 'estoque_saldos',id::text,to_jsonb(x) from public.estoque_saldos x on conflict do nothing;
commit;