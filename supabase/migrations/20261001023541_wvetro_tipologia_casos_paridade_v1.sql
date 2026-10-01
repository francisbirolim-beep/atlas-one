-- Casos individuais W.Vetro para validar paridade técnica contra o motor do Atlas.
-- Server-only: não expor ao cliente; a API Master é a fronteira de acesso.

create table if not exists public.wvetro_tipologia_casos (
  id uuid primary key default gen_random_uuid(),
  referencia_tipologia_id uuid not null
    references public.wvetro_referencias_tipologias(id) on delete cascade,
  tipologia_atlas_id uuid
    references public.tipologias(id) on delete set null,
  fonte text not null check (fonte in ('orcamento', 'pedido')),
  documento_chave text not null,
  item_indice integer not null check (item_indice >= 0),
  caso_chave text not null unique,
  data_referencia date,
  item_codigo text,
  item_nome text,
  ambiente text,
  largura_mm numeric,
  altura_mm numeric,
  quantidade numeric,
  valor_total numeric,
  perfis jsonb not null default '[]'::jsonb,
  acessorios jsonb not null default '[]'::jsonb,
  vidros jsonb not null default '[]'::jsonb,
  variaveis_observadas jsonb not null default '{}'::jsonb,
  item_raw jsonb not null default '{}'::jsonb,
  payload_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wvetro_tipologia_casos_perfis_array
    check (jsonb_typeof(perfis) = 'array'),
  constraint wvetro_tipologia_casos_acessorios_array
    check (jsonb_typeof(acessorios) = 'array'),
  constraint wvetro_tipologia_casos_vidros_array
    check (jsonb_typeof(vidros) = 'array'),
  constraint wvetro_tipologia_casos_variaveis_object
    check (jsonb_typeof(variaveis_observadas) = 'object'),
  constraint wvetro_tipologia_casos_raw_object
    check (jsonb_typeof(item_raw) = 'object')
);

create index if not exists idx_wvetro_tipologia_casos_referencia
  on public.wvetro_tipologia_casos(referencia_tipologia_id, data_referencia desc);

create index if not exists idx_wvetro_tipologia_casos_tipologia_atlas
  on public.wvetro_tipologia_casos(tipologia_atlas_id, data_referencia desc)
  where tipologia_atlas_id is not null;

create index if not exists idx_wvetro_tipologia_casos_medida
  on public.wvetro_tipologia_casos(referencia_tipologia_id, largura_mm, altura_mm, data_referencia desc);

create index if not exists idx_wvetro_tipologia_casos_documento
  on public.wvetro_tipologia_casos(fonte, documento_chave);

alter table public.wvetro_tipologia_casos enable row level security;

revoke all on table public.wvetro_tipologia_casos from anon;
revoke all on table public.wvetro_tipologia_casos from authenticated;
grant select, insert, update, delete on table public.wvetro_tipologia_casos to service_role;

comment on table public.wvetro_tipologia_casos is
  'Ocorrências técnicas individuais observadas no W.Vetro para validação de paridade; acesso somente por servidor/service_role.';

comment on column public.wvetro_tipologia_casos.caso_chave is
  'Identificador determinístico/idempotente do item de origem: fonte + documento + índice do item + identificação técnica da tipologia.';


create table if not exists public.wvetro_paridade_execucoes (
  id uuid primary key default gen_random_uuid(),
  periodo_inicio date not null,
  periodo_fim date not null,
  cursor_data date not null,
  status text not null default 'em_andamento'
    check (status in ('em_andamento','concluida','erro','cancelada')),
  dias_processados integer not null default 0,
  dias_pendentes integer not null default 0,
  itens_processados integer not null default 0,
  casos_processados integer not null default 0,
  tipologias_processadas integer not null default 0,
  ultima_mensagem text,
  erro text,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalizado_em timestamptz,
  constraint wvetro_paridade_execucoes_periodo_valido
    check (periodo_fim >= periodo_inicio)
);

create index if not exists idx_wvetro_paridade_execucoes_status
  on public.wvetro_paridade_execucoes(status, updated_at desc);

alter table public.wvetro_paridade_execucoes enable row level security;

revoke all on table public.wvetro_paridade_execucoes from anon;
revoke all on table public.wvetro_paridade_execucoes from authenticated;
grant select, insert, update, delete on table public.wvetro_paridade_execucoes to service_role;

create table if not exists public.wvetro_paridade_pendencias (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null
    references public.wvetro_paridade_execucoes(id) on delete cascade,
  data date not null,
  erro text not null,
  tentativas integer not null default 1,
  status text not null default 'pendente'
    check (status in ('pendente','resolvida')),
  resultado jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  unique (execucao_id, data)
);

create index if not exists idx_wvetro_paridade_pendencias_execucao_status
  on public.wvetro_paridade_pendencias(execucao_id, status, data);

alter table public.wvetro_paridade_pendencias enable row level security;

revoke all on table public.wvetro_paridade_pendencias from anon;
revoke all on table public.wvetro_paridade_pendencias from authenticated;
grant select, insert, update, delete on table public.wvetro_paridade_pendencias to service_role;

comment on table public.wvetro_paridade_execucoes is
  'Checkpoint resumível da captura histórica de casos individuais W.Vetro; não altera agregados da base técnica.';

comment on table public.wvetro_paridade_pendencias is
  'Dias que falharam durante a captura de casos individuais de paridade e podem ser reprocessados sem duplicar casos.';