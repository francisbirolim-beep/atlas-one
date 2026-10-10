create index if not exists orcamentos_margem_regra_cidade_fk_idx
  on public.orcamentos (margem_regra_cidade_id)
  where margem_regra_cidade_id is not null;