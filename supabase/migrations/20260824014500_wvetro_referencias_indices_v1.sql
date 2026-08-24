create index if not exists idx_wvetro_produtos_snapshot_produto_atlas
  on public.wvetro_produtos_snapshot(produto_atlas_id)
  where produto_atlas_id is not null;

create index if not exists idx_wvetro_referencias_componentes_produto_atlas
  on public.wvetro_referencias_componentes(produto_atlas_id)
  where produto_atlas_id is not null;

create index if not exists idx_wvetro_referencias_linhas_linha_tecnica
  on public.wvetro_referencias_linhas(linha_tecnica_id)
  where linha_tecnica_id is not null;

create index if not exists idx_wvetro_referencias_tipologias_tipologia_atlas
  on public.wvetro_referencias_tipologias(tipologia_atlas_id)
  where tipologia_atlas_id is not null;

create index if not exists idx_wvetro_referencias_vidros_produto_atlas
  on public.wvetro_referencias_vidros(produto_atlas_id)
  where produto_atlas_id is not null;
