-- Atlas One v9: Atlas AI Core - agentes de IA configuraveis + auditoria de uso
-- OBS: setores.id e do tipo text (nao uuid), entao setor_id aqui tambem e text.

create table if not exists agentes_ia (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  atualizado_em timestamptz default now(),

  nome text not null,
  escopo text not null default 'setor',
  setor_id text references setores(id),

  provider text not null default 'anthropic',
  modelo text not null default 'claude-sonnet-5',
  temperatura numeric not null default 1,

  instrucoes text,
  ativo boolean not null default true,

  criado_por_id uuid,
  criado_por_nome text
);

create index if not exists idx_agentes_ia_escopo on agentes_ia(escopo);
create index if not exists idx_agentes_ia_setor_id on agentes_ia(setor_id);

alter table agentes_ia enable row level security;
drop policy if exists "acesso_total_temporario" on agentes_ia;
create policy "acesso_total_temporario" on agentes_ia
  for all using (true) with check (true);

create table if not exists ia_uso_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  agente_id uuid references agentes_ia(id),
  usuario_id uuid,
  usuario_nome text,

  provider text,
  modelo text,

  tokens_entrada integer,
  tokens_saida integer,

  passos integer,
  sucesso boolean default true,
  erro text
);

create index if not exists idx_ia_uso_log_usuario_id on ia_uso_log(usuario_id);
create index if not exists idx_ia_uso_log_created_at on ia_uso_log(created_at desc);
create index if not exists idx_ia_uso_log_agente_id on ia_uso_log(agente_id);

alter table ia_uso_log enable row level security;
drop policy if exists "acesso_total_temporario" on ia_uso_log;
create policy "acesso_total_temporario" on ia_uso_log
  for all using (true) with check (true);
