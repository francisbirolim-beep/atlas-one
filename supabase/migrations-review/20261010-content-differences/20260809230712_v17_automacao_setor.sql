
create table if not exists automacoes_setor (
  id uuid primary key default gen_random_uuid(),
  nome text,
  coluna_id uuid not null references kanban_colunas(id) on delete cascade,
  setor_id text not null references setores(id) on delete cascade,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table setor_kanban_itens
  add column if not exists orcamento_id uuid references orcamentos(id) on delete set null;

alter table automacoes_setor enable row level security;

drop policy if exists acesso_total_temporario on automacoes_setor;
create policy acesso_total_temporario on automacoes_setor for all using (true) with check (true);
;
