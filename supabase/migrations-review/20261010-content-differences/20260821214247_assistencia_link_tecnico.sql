-- Atlas One — Assistência externa para técnico + atendimento assinado
-- Link seguro por token (hash no banco) e dados do atendimento gravados no chamado.

alter table assistencias
  add column if not exists tecnico_nome text,
  add column if not exists data_atendimento date,
  add column if not exists servico_realizado text,
  add column if not exists materiais_utilizados text,
  add column if not exists observacoes_atendimento text,
  add column if not exists assinatura_tecnico text,
  add column if not exists assinatura_cliente text,
  add column if not exists atendimento_concluido_em timestamptz;

create table if not exists assistencia_acessos_externos (
  id uuid primary key default gen_random_uuid(),
  assistencia_id uuid not null references assistencias(id) on delete cascade,
  token_hash text not null unique,
  nome_tecnico text,
  telefone_tecnico text,
  expira_em timestamptz,
  revogado_em timestamptz,
  primeiro_acesso_em timestamptz,
  ultimo_acesso_em timestamptz,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistencia_acessos_assistencia
  on assistencia_acessos_externos(assistencia_id, created_at desc);

create index if not exists idx_assistencia_acessos_token_hash
  on assistencia_acessos_externos(token_hash);

alter table assistencia_acessos_externos enable row level security;

-- A tabela de tokens é acessada somente pelas API routes com service role.
-- Sem policy pública o navegador não consegue listar/alterar tokens diretamente.
