-- Atlas One — Migration V20 — Medicao Final V2
--
-- IMPORTANTE:
-- 1. Este arquivo e a fonte versionada da proxima evolucao do schema.
-- 2. Ele NAO significa que a migration ja foi aplicada no Supabase atual.
-- 3. Aplicar e validar no banco antes de mergear qualquer codigo que dependa
--    destas novas colunas/tabelas.
-- 4. A migration e aditiva: nao remove nem renomeia campos existentes.

-- ---------------------------------------------------------------------------
-- 1. Estado operacional e responsavel no nivel da Medicao Final
-- ---------------------------------------------------------------------------

alter table medicoes_finais
  add column if not exists status_operacional text not null default 'aguardando_liberacao',
  add column if not exists responsavel_id uuid,
  add column if not exists responsavel_nome text,
  add column if not exists liberado_em timestamptz,
  add column if not exists liberado_por_id uuid,
  add column if not exists liberado_por_nome text,
  add column if not exists iniciado_em timestamptz,
  add column if not exists concluido_em timestamptz,
  add column if not exists aprovado_em timestamptz,
  add column if not exists aprovado_por_id uuid,
  add column if not exists aprovado_por_nome text,
  add column if not exists versao integer not null default 1,
  add column if not exists observacoes text;

-- Valores previstos para status_operacional, sem CHECK por enquanto para manter
-- compatibilidade com configuracao futura de workflow:
-- aguardando_liberacao | liberado | iniciado | parcialmente_concluido |
-- concluido | com_pendencia | aguardando_revisao | aprovado |
-- liberado_engenharia

create index if not exists idx_medicoes_finais_status_operacional
  on medicoes_finais(status_operacional);

create index if not exists idx_medicoes_finais_responsavel_id
  on medicoes_finais(responsavel_id);

-- ---------------------------------------------------------------------------
-- 2. Pendencias por obra ou por peca
-- ---------------------------------------------------------------------------

create table if not exists medicao_pendencias (
  id uuid primary key default gen_random_uuid(),
  medicao_id uuid not null references medicoes_finais(id) on delete cascade,
  item_id uuid references medicao_itens(id) on delete cascade,
  categoria text not null default 'outro',
  descricao text not null,
  status text not null default 'aberta',
  responsavel_solucao text,
  foto_urls jsonb not null default '[]'::jsonb,
  criado_por_id uuid,
  criado_por_nome text,
  resolvido_por_id uuid,
  resolvido_por_nome text,
  resolvido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_medicao_pendencias_medicao
  on medicao_pendencias(medicao_id);

create index if not exists idx_medicao_pendencias_item
  on medicao_pendencias(item_id);

create index if not exists idx_medicao_pendencias_status
  on medicao_pendencias(status);

-- ---------------------------------------------------------------------------
-- 3. Fotos categorizadas por peca
-- ---------------------------------------------------------------------------

create table if not exists medicao_fotos (
  id uuid primary key default gen_random_uuid(),
  medicao_id uuid not null references medicoes_finais(id) on delete cascade,
  item_id uuid references medicao_itens(id) on delete cascade,
  categoria text not null default 'outra',
  url text not null,
  legenda text,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now()
);

-- Categorias iniciais sugeridas:
-- geral | largura | altura | piso | teto | lateral_esquerda | lateral_direita |
-- interferencia | contramarco | trilho | outra

create index if not exists idx_medicao_fotos_medicao
  on medicao_fotos(medicao_id);

create index if not exists idx_medicao_fotos_item
  on medicao_fotos(item_id);

-- ---------------------------------------------------------------------------
-- 4. Checklist dinamico: evolucao da definicao e respostas normalizadas
-- ---------------------------------------------------------------------------

alter table tipologia_campos_extras
  add column if not exists secao text,
  add column if not exists opcoes jsonb not null default '[]'::jsonb,
  add column if not exists regra_condicional jsonb not null default '{}'::jsonb,
  add column if not exists exigir_foto_quando jsonb not null default '[]'::jsonb,
  add column if not exists ativo boolean not null default true;

-- tipo_valor continua text e passa a aceitar, alem dos atuais numero/texto/foto:
-- selecao | booleano | sim_nao_na | textarea

create table if not exists medicao_respostas (
  id uuid primary key default gen_random_uuid(),
  medicao_id uuid not null references medicoes_finais(id) on delete cascade,
  item_id uuid not null references medicao_itens(id) on delete cascade,
  campo_id uuid references tipologia_campos_extras(id) on delete set null,
  campo_chave text not null,
  valor jsonb,
  observacao text,
  foto_urls jsonb not null default '[]'::jsonb,
  respondido_por_id uuid,
  respondido_por_nome text,
  respondido_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(item_id, campo_chave)
);

create index if not exists idx_medicao_respostas_item
  on medicao_respostas(item_id);

-- ---------------------------------------------------------------------------
-- 5. Link externo seguro
-- ---------------------------------------------------------------------------

create table if not exists medicao_acessos_externos (
  id uuid primary key default gen_random_uuid(),
  medicao_id uuid not null references medicoes_finais(id) on delete cascade,
  token_hash text not null unique,
  nome_convidado text,
  telefone_convidado text,
  expira_em timestamptz,
  revogado_em timestamptz,
  primeiro_acesso_em timestamptz,
  ultimo_acesso_em timestamptz,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now()
);

-- Nunca salvar o token bruto no banco. Gerar token criptograficamente seguro no
-- servidor e persistir somente hash. O token bruto existe apenas no link entregue.

create index if not exists idx_medicao_acessos_externos_medicao
  on medicao_acessos_externos(medicao_id);

-- ---------------------------------------------------------------------------
-- 6. Revisoes/versionamento da Medicao Final
-- ---------------------------------------------------------------------------

create table if not exists medicao_revisoes (
  id uuid primary key default gen_random_uuid(),
  medicao_id uuid not null references medicoes_finais(id) on delete cascade,
  versao integer not null,
  motivo text,
  snapshot jsonb not null,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  unique(medicao_id, versao)
);

create index if not exists idx_medicao_revisoes_medicao
  on medicao_revisoes(medicao_id);

-- ---------------------------------------------------------------------------
-- 7. Politicas permissivas coerentes com o estagio atual do Atlas
-- ---------------------------------------------------------------------------
-- O Atlas ainda usa auth propria e o projeto registra que RLS nao e a camada de
-- autorizacao efetiva hoje. Para nao quebrar o acesso direto via Supabase client,
-- as novas tabelas seguem o padrao permissivo atual. Reforco de seguranca deve ser
-- uma iniciativa deliberada e abrangente, nao uma mudanca incidental neste modulo.

alter table medicao_pendencias enable row level security;
alter table medicao_fotos enable row level security;
alter table medicao_respostas enable row level security;
alter table medicao_acessos_externos enable row level security;
alter table medicao_revisoes enable row level security;

do $$
begin
  create policy "acesso total medicao_pendencias" on medicao_pendencias
    for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "acesso total medicao_fotos" on medicao_fotos
    for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "acesso total medicao_respostas" on medicao_respostas
    for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "acesso total medicao_acessos_externos" on medicao_acessos_externos
    for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "acesso total medicao_revisoes" on medicao_revisoes
    for all using (true) with check (true);
exception when duplicate_object then null;
end $$;
