-- WhatsApp IA — aprendizado progressivo e assistente supervisionado.
-- Etapas: observando -> sugerindo -> automatico.
-- As tabelas sao backend-only; nenhum conteudo pessoal e exposto diretamente ao cliente.

create table if not exists public.atendimento_whatsapp_ia_config (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  modo text not null default 'observando'
    check (modo in ('observando','sugerindo','automatico')),
  ativo boolean not null default true,
  aprender_todos_canais boolean not null default true,
  classificar_canal_pessoal boolean not null default true,
  exigir_validacao_conhecimento boolean not null default true,
  confianca_minima_sugestao numeric not null default 0.70
    check (confianca_minima_sugestao between 0 and 1),
  confianca_minima_automatico numeric not null default 0.92
    check (confianca_minima_automatico between 0 and 1),
  atualizado_por_id uuid null,
  atualizado_por_nome text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atendimento_whatsapp_ia_canais (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid not null references public.atendimento_whatsapp_canais(id) on delete cascade,
  aprender boolean not null default true,
  classificacao text not null default 'auto'
    check (classificacao in ('auto','empresa','pessoal')),
  setor_padrao text null,
  permitir_sugestoes boolean not null default true,
  permitir_automatico boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (empresa_id, canal_id)
);

create table if not exists public.atendimento_whatsapp_ia_observacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid not null references public.atendimento_whatsapp_canais(id) on delete cascade,
  conversa_id uuid not null references public.atendimento_conversas(id) on delete cascade,
  mensagem_id uuid not null references public.atendimento_mensagens(id) on delete cascade,
  classe text not null check (classe in ('empresa','pessoal','duvida')),
  setor text null,
  confianca numeric null check (confianca is null or confianca between 0 and 1),
  aprendizado_resumo text null,
  motivo text null,
  entrada_aprendizado_id uuid null references public.ai_aprendizado_entradas(id) on delete set null,
  candidato_aprendizado_id uuid null references public.ai_aprendizado_candidatos(id) on delete set null,
  metadados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (empresa_id, mensagem_id)
);

create table if not exists public.atendimento_whatsapp_ia_sugestoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid not null references public.atendimento_whatsapp_canais(id) on delete cascade,
  conversa_id uuid not null references public.atendimento_conversas(id) on delete cascade,
  mensagem_id uuid not null references public.atendimento_mensagens(id) on delete cascade,
  texto text not null,
  setor text null,
  confianca numeric null check (confianca is null or confianca between 0 and 1),
  status text not null default 'pendente'
    check (status in ('pendente','usada','editada','rejeitada','enviada_automaticamente','cancelada')),
  texto_final text null,
  usuario_id uuid null,
  usuario_nome text null,
  decidido_em timestamptz null,
  metadados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, mensagem_id)
);

create index if not exists atendimento_whatsapp_ia_observacoes_empresa_classe_idx
  on public.atendimento_whatsapp_ia_observacoes (empresa_id, classe, created_at desc);
create index if not exists atendimento_whatsapp_ia_observacoes_empresa_setor_idx
  on public.atendimento_whatsapp_ia_observacoes (empresa_id, setor, created_at desc);
create index if not exists atendimento_whatsapp_ia_sugestoes_conversa_status_idx
  on public.atendimento_whatsapp_ia_sugestoes (empresa_id, conversa_id, status, created_at desc);

alter table public.atendimento_whatsapp_ia_config enable row level security;
alter table public.atendimento_whatsapp_ia_canais enable row level security;
alter table public.atendimento_whatsapp_ia_observacoes enable row level security;
alter table public.atendimento_whatsapp_ia_sugestoes enable row level security;

revoke all on table public.atendimento_whatsapp_ia_config from anon, authenticated;
revoke all on table public.atendimento_whatsapp_ia_canais from anon, authenticated;
revoke all on table public.atendimento_whatsapp_ia_observacoes from anon, authenticated;
revoke all on table public.atendimento_whatsapp_ia_sugestoes from anon, authenticated;

comment on table public.atendimento_whatsapp_ia_config is
  'Controle Master do assistente WhatsApp: observando, sugerindo ou automatico.';
comment on table public.atendimento_whatsapp_ia_observacoes is
  'Classificacao segura das mensagens para separar negocio, pessoal e duvida. Conteudo pessoal nao vira conhecimento.';
comment on table public.atendimento_whatsapp_ia_sugestoes is
  'Sugestoes supervisionadas e respostas automaticas auditaveis do WhatsApp Atlas.';