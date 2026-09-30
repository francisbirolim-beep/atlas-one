-- Atlas One — Neon staging da migração operacional W.Vetro
-- Data: 2026-09-30
-- Destino: Neon Postgres
-- Seguro para reaplicação: CREATE IF NOT EXISTS / índices idempotentes.
--
-- NÃO contém tabelas operacionais do Atlas.
-- O objetivo deste schema é preservar snapshots externos, checkpoints,
-- reconciliações e pendências antes de qualquer promoção ao Supabase oficial.

create schema if not exists wvetro_migracao;

comment on schema wvetro_migracao is
  'Staging isolado W.Vetro -> Atlas. Nenhum dado deste schema é operacional até promoção explícita.';

create table if not exists wvetro_migracao.execucoes (
  id uuid primary key default gen_random_uuid(),
  recurso text not null,
  periodo_inicio date null,
  periodo_fim date null,
  cursor_data date null,
  status text not null default 'preparada'
    check (status in ('preparada','em_andamento','pausada','concluida','erro','cancelada')),
  total_lidos integer not null default 0 check (total_lidos >= 0),
  total_novos integer not null default 0 check (total_novos >= 0),
  total_vinculados integer not null default 0 check (total_vinculados >= 0),
  total_divergentes integer not null default 0 check (total_divergentes >= 0),
  total_ignorados integer not null default 0 check (total_ignorados >= 0),
  total_erros integer not null default 0 check (total_erros >= 0),
  ultima_mensagem text null,
  erro text null,
  criado_por_id uuid null,
  criado_por_nome text null,
  iniciado_em timestamptz null,
  finalizado_em timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wvetro_migracao_execucoes_periodo_ck
    check (periodo_inicio is null or periodo_fim is null or periodo_fim >= periodo_inicio)
);

create index if not exists idx_wvetro_migracao_execucoes_recurso_status
  on wvetro_migracao.execucoes(recurso, status, updated_at desc);

create table if not exists wvetro_migracao.raw (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid null references wvetro_migracao.execucoes(id) on delete set null,
  recurso text not null,
  chave_externa text not null,
  data_referencia date null,
  versao integer not null default 1 check (versao > 0),
  payload jsonb not null,
  payload_hash text not null check (char_length(payload_hash) = 64),
  capturado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint uq_wvetro_migracao_raw_hash
    unique (recurso, chave_externa, payload_hash),
  constraint uq_wvetro_migracao_raw_versao
    unique (recurso, chave_externa, versao)
);

create index if not exists idx_wvetro_migracao_raw_recurso_chave
  on wvetro_migracao.raw(recurso, chave_externa);

create index if not exists idx_wvetro_migracao_raw_data
  on wvetro_migracao.raw(recurso, data_referencia);

create index if not exists idx_wvetro_migracao_raw_execucao
  on wvetro_migracao.raw(execucao_id);

create table if not exists wvetro_migracao.vinculos (
  id uuid primary key default gen_random_uuid(),
  recurso text not null,
  chave_externa text not null,
  entidade_atlas text not null,
  atlas_id uuid null,
  status text not null default 'novo'
    check (status in ('novo','sugerido','vinculado','divergente','ignorado')),
  metodo_match text null,
  confianca numeric(5,4) null
    check (confianca is null or (confianca >= 0 and confianca <= 1)),
  revisado_por_id uuid null,
  revisado_por_nome text null,
  revisado_em timestamptz null,
  observacoes text null,
  dados_reconciliacao jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_wvetro_migracao_vinculo
    unique (recurso, chave_externa, entidade_atlas)
);

create index if not exists idx_wvetro_migracao_vinculos_status
  on wvetro_migracao.vinculos(recurso, status, updated_at desc);

create index if not exists idx_wvetro_migracao_vinculos_atlas
  on wvetro_migracao.vinculos(entidade_atlas, atlas_id)
  where atlas_id is not null;

create table if not exists wvetro_migracao.pendencias (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid null references wvetro_migracao.execucoes(id) on delete set null,
  recurso text not null,
  chave_externa text null,
  tipo text not null default 'reconciliacao'
    check (tipo in ('captura','reconciliacao','promocao','validacao')),
  motivo text not null,
  contexto jsonb not null default '{}'::jsonb,
  status text not null default 'pendente'
    check (status in ('pendente','em_revisao','resolvida','ignorada')),
  tentativas integer not null default 0 check (tentativas >= 0),
  resolvido_por_id uuid null,
  resolvido_por_nome text null,
  resolvido_em timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wvetro_migracao_pendencias_status
  on wvetro_migracao.pendencias(recurso, status, updated_at desc);

create index if not exists idx_wvetro_migracao_pendencias_execucao
  on wvetro_migracao.pendencias(execucao_id);

-- Bloqueio preventivo para papéis genéricos, caso existam no projeto Neon.
-- A aplicação deve conectar com um usuário/role servidor dedicado e manter
-- a connection string apenas no ambiente da Vercel.
revoke all on schema wvetro_migracao from public;
revoke all on all tables in schema wvetro_migracao from public;
revoke all on all sequences in schema wvetro_migracao from public;

-- Conferência final.
select
  to_regclass('wvetro_migracao.execucoes') is not null as execucoes_ok,
  to_regclass('wvetro_migracao.raw') is not null as raw_ok,
  to_regclass('wvetro_migracao.vinculos') is not null as vinculos_ok,
  to_regclass('wvetro_migracao.pendencias') is not null as pendencias_ok;
