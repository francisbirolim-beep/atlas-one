alter table public.configuracoes_gerais alter column empresa_id set not null;
create unique index if not exists configuracoes_gerais_empresa_chave_uidx on public.configuracoes_gerais(empresa_id,chave);
