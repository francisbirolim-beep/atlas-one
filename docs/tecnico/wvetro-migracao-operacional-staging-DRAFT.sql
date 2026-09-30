-- RASCUNHO TÉCNICO — NÃO APLICAR DIRETAMENTE
-- W.Vetro -> Atlas One: staging da migração operacional.
-- Data: 2026-09-30
--
-- Este arquivo fica fora de supabase/migrations de propósito.
-- Antes de virar migration oficial:
-- 1) gerar arquivo com "supabase migration new wvetro_migracao_operacional_staging_v1";
-- 2) copiar/revisar este SQL;
-- 3) testar em branch/banco isolado;
-- 4) rodar advisors;
-- 5) somente depois considerar produção.
--
-- Estratégia:
-- - raw imutável para preservar a fonte;
-- - execução/checkpoint separado;
-- - vínculo externo -> Atlas separado da origem;
-- - pendência auditável;
-- - nenhuma tabela exposta a anon/authenticated;
-- - service_role explícito porque o backend usa Supabase Data API server-side.

create table if not exists public.wvetro_operacional_execucoes (
  id uuid primary key default gen_random_uuid(),
  recurso text not null,
  periodo_inicio date null,
  periodo_fim date null,
  cursor_data date null,
  status text not null default 'preparada'
    check (status in ('preparada','em_andamento','pausada','concluida','erro','cancelada')),
  total_lidos integer not null default 0,
  total_novos integer not null default 0,
  total_vinculados integer not null default 0,
  total_divergentes integer not null default 0,
  total_ignorados integer not null default 0,
  total_erros integer not null default 0,
  ultima_mensagem text null,
  erro text null,
  criado_por_id uuid null,
  criado_por_nome text null,
  iniciado_em timestamptz null,
  finalizado_em timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wvetro_operacional_execucoes_periodo_ck
    check (periodo_inicio is null or periodo_fim is null or periodo_fim >= periodo_inicio)
);

create index if not exists idx_wvetro_operacional_execucoes_recurso_status
  on public.wvetro_operacional_execucoes(recurso,status,updated_at desc);

comment on table public.wvetro_operacional_execucoes is
  'Checkpoint/auditoria das cargas operacionais W.Vetro. Separado da carga de base técnica.';

create table if not exists public.wvetro_operacional_raw (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid null references public.wvetro_operacional_execucoes(id) on delete set null,
  recurso text not null,
  chave_externa text not null,
  data_referencia date null,
  versao integer not null default 1,
  payload jsonb not null,
  payload_hash text not null,
  capturado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint uq_wvetro_operacional_raw_hash
    unique (recurso,chave_externa,payload_hash)
);

create index if not exists idx_wvetro_operacional_raw_recurso_chave
  on public.wvetro_operacional_raw(recurso,chave_externa);

create index if not exists idx_wvetro_operacional_raw_data
  on public.wvetro_operacional_raw(recurso,data_referencia);

create index if not exists idx_wvetro_operacional_raw_execucao
  on public.wvetro_operacional_raw(execucao_id);

comment on table public.wvetro_operacional_raw is
  'Snapshot bruto imutável dos recursos operacionais W.Vetro para reprocessamento e auditoria.';

create table if not exists public.wvetro_operacional_vinculos (
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
  constraint uq_wvetro_operacional_vinculo
    unique (recurso,chave_externa,entidade_atlas)
);

create index if not exists idx_wvetro_operacional_vinculos_status
  on public.wvetro_operacional_vinculos(recurso,status,updated_at desc);

create index if not exists idx_wvetro_operacional_vinculos_atlas
  on public.wvetro_operacional_vinculos(entidade_atlas,atlas_id)
  where atlas_id is not null;

comment on table public.wvetro_operacional_vinculos is
  'Reconciliação auditável entre chave externa W.Vetro e entidade oficial Atlas.';

create table if not exists public.wvetro_operacional_pendencias (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid null references public.wvetro_operacional_execucoes(id) on delete set null,
  recurso text not null,
  chave_externa text null,
  tipo text not null default 'reconciliacao'
    check (tipo in ('captura','reconciliacao','promocao','validacao')),
  motivo text not null,
  contexto jsonb not null default '{}'::jsonb,
  status text not null default 'pendente'
    check (status in ('pendente','em_revisao','resolvida','ignorada')),
  tentativas integer not null default 0,
  resolvido_por_id uuid null,
  resolvido_por_nome text null,
  resolvido_em timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wvetro_operacional_pendencias_status
  on public.wvetro_operacional_pendencias(recurso,status,updated_at desc);

create index if not exists idx_wvetro_operacional_pendencias_execucao
  on public.wvetro_operacional_pendencias(execucao_id);

comment on table public.wvetro_operacional_pendencias is
  'Pendências de captura, reconciliação, validação e promoção da migração operacional W.Vetro.';

-- Segurança: staging é exclusivamente server-side.
alter table public.wvetro_operacional_execucoes enable row level security;
alter table public.wvetro_operacional_raw enable row level security;
alter table public.wvetro_operacional_vinculos enable row level security;
alter table public.wvetro_operacional_pendencias enable row level security;

revoke all on public.wvetro_operacional_execucoes from anon, authenticated;
revoke all on public.wvetro_operacional_raw from anon, authenticated;
revoke all on public.wvetro_operacional_vinculos from anon, authenticated;
revoke all on public.wvetro_operacional_pendencias from anon, authenticated;

grant select,insert,update,delete on public.wvetro_operacional_execucoes to service_role;
grant select,insert,update,delete on public.wvetro_operacional_raw to service_role;
grant select,insert,update,delete on public.wvetro_operacional_vinculos to service_role;
grant select,insert,update,delete on public.wvetro_operacional_pendencias to service_role;

-- Não criar policies para authenticated/anon nesta fase.
-- A interface Master deve operar por rotas server-side autenticadas,
-- jamais consultando o staging diretamente pelo cliente.
