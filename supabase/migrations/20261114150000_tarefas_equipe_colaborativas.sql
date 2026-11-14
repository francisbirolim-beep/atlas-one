-- Módulo novo e isolado. Não altera as tabelas de tarefas e agenda existentes.
-- Acesso exclusivamente via rotas server-side autenticadas; RLS fechado no cliente.
create table if not exists public.atlas_tarefas_equipe (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  criado_por_id uuid not null references public.usuarios(id),
  titulo text not null check (length(trim(titulo)) between 1 and 300),
  descricao text,
  responsaveis_ids uuid[] not null default '{}',
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta','urgente')),
  data_hora timestamptz,
  status text not null default 'a_fazer' check (status in ('a_fazer','em_andamento','aguardando','concluido')),
  compartilhada boolean not null default true,
  lote_id uuid,
  serie_id uuid,
  recorrencia_tipo text check (recorrencia_tipo is null or recorrencia_tipo in ('semanal','mensal','dia_util_mes')),
  recorrencia_valor integer,
  recorrencia_dias integer[],
  concluida_em timestamptz,
  concluida_por_id uuid,
  iniciada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists atlas_tarefas_equipe_autor_idx
  on public.atlas_tarefas_equipe(empresa_id, criado_por_id, created_at desc);
create index if not exists atlas_tarefas_equipe_periodo_idx
  on public.atlas_tarefas_equipe(empresa_id, data_hora);
create index if not exists atlas_tarefas_equipe_responsaveis_idx
  on public.atlas_tarefas_equipe using gin(responsaveis_ids);
create unique index if not exists atlas_tarefas_equipe_serie_unica
  on public.atlas_tarefas_equipe(serie_id, data_hora) where serie_id is not null and data_hora is not null;

create table if not exists public.atlas_tarefa_comentarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  tarefa_id uuid not null references public.atlas_tarefas_equipe(id) on delete cascade,
  autor_id uuid not null references public.usuarios(id),
  texto text not null check (length(trim(texto)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists atlas_tarefa_comentarios_tarefa_idx on public.atlas_tarefa_comentarios(tarefa_id, created_at desc);

create table if not exists public.atlas_tarefa_historico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  tarefa_id uuid not null references public.atlas_tarefas_equipe(id) on delete cascade,
  autor_id uuid references public.usuarios(id),
  acao text not null,
  detalhe text,
  created_at timestamptz not null default now()
);
create index if not exists atlas_tarefa_historico_tarefa_idx on public.atlas_tarefa_historico(tarefa_id,created_at desc);

create table if not exists public.atlas_tarefa_avisos (
  empresa_id uuid not null,
  tarefa_id uuid not null references public.atlas_tarefas_equipe(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id),
  proximo_aviso_em timestamptz not null default now(),
  ultimo_aviso_em timestamptz,
  visto_em timestamptz,
  primary key(tarefa_id,usuario_id)
);
create index if not exists atlas_tarefa_avisos_usuario_idx on public.atlas_tarefa_avisos(usuario_id,proximo_aviso_em);

alter table public.atlas_tarefas_equipe enable row level security;
alter table public.atlas_tarefa_comentarios enable row level security;
alter table public.atlas_tarefa_historico enable row level security;
alter table public.atlas_tarefa_avisos enable row level security;
revoke all on public.atlas_tarefas_equipe, public.atlas_tarefa_comentarios, public.atlas_tarefa_historico, public.atlas_tarefa_avisos from anon, authenticated;
grant all on public.atlas_tarefas_equipe, public.atlas_tarefa_comentarios, public.atlas_tarefa_historico, public.atlas_tarefa_avisos to service_role;
