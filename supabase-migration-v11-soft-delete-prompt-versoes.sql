-- Atlas One v11: soft-delete de agentes de IA + versionamento de instrucoes de IA por setor
-- Nao altera nada de forma destrutiva: so adiciona colunas novas (com default) e uma tabela nova.

alter table agentes_ia add column if not exists arquivado boolean not null default false;
alter table agentes_ia add column if not exists arquivado_em timestamptz;

create table if not exists setor_instrucoes_versoes (
  id uuid primary key default gen_random_uuid(),
  setor_id text not null references setores(id),
  versao integer not null,
  conteudo text,
  autor_id uuid,
  autor_nome text,
  criado_em timestamptz default now(),
  justificativa text,
  status text not null default 'ativa',
  restaurada_de_versao integer
);

create index if not exists idx_setor_instrucoes_versoes_setor_id on setor_instrucoes_versoes(setor_id);
create unique index if not exists idx_setor_instrucoes_versoes_setor_versao on setor_instrucoes_versoes(setor_id, versao);

alter table setor_instrucoes_versoes enable row level security;
drop policy if exists "acesso_total_temporario" on setor_instrucoes_versoes;
create policy "acesso_total_temporario" on setor_instrucoes_versoes
  for all using (true) with check (true);
