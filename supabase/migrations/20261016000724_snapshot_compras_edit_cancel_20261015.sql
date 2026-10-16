begin;
create table if not exists private.atlas_compras_snapshot_edicao_20261015 (
 origem text not null,registro_id text not null,dados jsonb not null,
 salvo_em timestamptz not null default now(), primary key(origem,registro_id)
);
revoke all on private.atlas_compras_snapshot_edicao_20261015 from public,anon,authenticated;
insert into private.atlas_compras_snapshot_edicao_20261015(origem,registro_id,dados)
 select 'compras_solicitacoes',id::text,to_jsonb(t) from public.compras_solicitacoes t on conflict do nothing;
insert into private.atlas_compras_snapshot_edicao_20261015(origem,registro_id,dados)
 select 'compras_solicitacao_itens',id::text,to_jsonb(t) from public.compras_solicitacao_itens t on conflict do nothing;
insert into private.atlas_compras_snapshot_edicao_20261015(origem,registro_id,dados)
 select 'compras_carrinhos',id::text,to_jsonb(t) from public.compras_carrinhos t on conflict do nothing;
insert into private.atlas_compras_snapshot_edicao_20261015(origem,registro_id,dados)
 select 'compras_carrinho_itens',id::text,to_jsonb(t) from public.compras_carrinho_itens t on conflict do nothing;
commit;