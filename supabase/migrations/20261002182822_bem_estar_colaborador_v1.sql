-- Atlas Pessoas / IA - governança, bem-estar e voz do colaborador v1
-- Privacidade por padrão: diário privado é visível apenas ao próprio usuário pela Data API.
-- Painéis de gestão devem usar rotas server-side que removam identidade quando modo_identidade = 'anonimo_gestao'.

create table if not exists public.ia_pessoas_preferencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  termos_versao text not null default 'v1',
  termos_aceitos_em timestamptz,
  termos_revogados_em timestamptz,
  diario_habilitado boolean not null default true,
  compartilhar_metricas_agregadas boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, usuario_id)
);

create table if not exists public.ia_diario_privado (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  conversa_id uuid,
  papel text not null check (papel in ('usuario','assistente','sistema')),
  conteudo text not null,
  humor_declarado smallint check (humor_declarado between 1 and 5),
  contexto_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ia_diario_privado_usuario_created_idx
  on public.ia_diario_privado (empresa_id, usuario_id, created_at desc);

create table if not exists public.ia_feedback_colaborador (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  usuario_id uuid references public.usuarios(id) on delete set null,
  modo_identidade text not null check (modo_identidade in ('identificado','anonimo_gestao')),
  origem text not null default 'espontaneo'
    check (origem in ('espontaneo','pesquisa','diario_compartilhado','denuncia_formal')),
  categoria text,
  texto text not null,
  deseja_contato boolean not null default false,
  status text not null default 'recebido'
    check (status in ('recebido','em_analise','encaminhado','concluido','arquivado')),
  contexto_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ia_feedback_colaborador_empresa_created_idx
  on public.ia_feedback_colaborador (empresa_id, created_at desc);

create table if not exists public.ia_clima_campanhas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  titulo text not null,
  descricao text,
  inicia_em timestamptz,
  encerra_em timestamptz,
  ativo boolean not null default true,
  criado_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ia_clima_perguntas (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.ia_clima_campanhas(id) on delete cascade,
  ordem integer not null default 0,
  texto text not null,
  tipo text not null default 'texto'
    check (tipo in ('texto','escala_1_5','sim_nao','opcoes')),
  opcoes_json jsonb not null default '[]'::jsonb,
  obrigatoria boolean not null default false
);

create table if not exists public.ia_clima_respostas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  campanha_id uuid not null references public.ia_clima_campanhas(id) on delete cascade,
  pergunta_id uuid not null references public.ia_clima_perguntas(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,
  modo_identidade text not null check (modo_identidade in ('identificado','anonimo_gestao')),
  resposta_texto text,
  resposta_numero numeric,
  resposta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ia_clima_respostas_empresa_campanha_idx
  on public.ia_clima_respostas (empresa_id, campanha_id, created_at desc);

create unique index if not exists ia_clima_respostas_usuario_pergunta_uniq
  on public.ia_clima_respostas (campanha_id, pergunta_id, usuario_id)
  where usuario_id is not null;

create table if not exists public.ia_acessos_dominio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  dominio text not null,
  escopo text not null default 'nenhum'
    check (escopo in ('nenhum','proprio','setor','empresa')),
  permitido boolean not null default true,
  configurado_por uuid references public.usuarios(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (empresa_id, usuario_id, dominio)
);

create table if not exists public.ia_auditoria_dados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  usuario_id uuid references public.usuarios(id) on delete set null,
  dominio text not null,
  escopo_aplicado text,
  acao text not null check (acao in ('permitido','bloqueado')),
  motivo text,
  contexto text,
  created_at timestamptz not null default now()
);

create index if not exists ia_auditoria_dados_empresa_created_idx
  on public.ia_auditoria_dados (empresa_id, created_at desc);

alter table public.ia_pessoas_preferencias enable row level security;
alter table public.ia_diario_privado enable row level security;
alter table public.ia_feedback_colaborador enable row level security;
alter table public.ia_clima_campanhas enable row level security;
alter table public.ia_clima_perguntas enable row level security;
alter table public.ia_clima_respostas enable row level security;
alter table public.ia_acessos_dominio enable row level security;
alter table public.ia_auditoria_dados enable row level security;

drop policy if exists ia_pessoas_preferencias_self_select on public.ia_pessoas_preferencias;
create policy ia_pessoas_preferencias_self_select
on public.ia_pessoas_preferencias for select to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists ia_pessoas_preferencias_self_insert on public.ia_pessoas_preferencias;
create policy ia_pessoas_preferencias_self_insert
on public.ia_pessoas_preferencias for insert to authenticated
with check (usuario_id = (select auth.uid()));

drop policy if exists ia_pessoas_preferencias_self_update on public.ia_pessoas_preferencias;
create policy ia_pessoas_preferencias_self_update
on public.ia_pessoas_preferencias for update to authenticated
using (usuario_id = (select auth.uid()))
with check (usuario_id = (select auth.uid()));

drop policy if exists ia_diario_privado_self_select on public.ia_diario_privado;
create policy ia_diario_privado_self_select
on public.ia_diario_privado for select to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists ia_diario_privado_self_insert on public.ia_diario_privado;
create policy ia_diario_privado_self_insert
on public.ia_diario_privado for insert to authenticated
with check (usuario_id = (select auth.uid()));

drop policy if exists ia_diario_privado_self_delete on public.ia_diario_privado;
create policy ia_diario_privado_self_delete
on public.ia_diario_privado for delete to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists ia_feedback_colaborador_self_select on public.ia_feedback_colaborador;
create policy ia_feedback_colaborador_self_select
on public.ia_feedback_colaborador for select to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists ia_feedback_colaborador_self_insert on public.ia_feedback_colaborador;
create policy ia_feedback_colaborador_self_insert
on public.ia_feedback_colaborador for insert to authenticated
with check (usuario_id = (select auth.uid()));

drop policy if exists ia_feedback_colaborador_self_update on public.ia_feedback_colaborador;

drop policy if exists ia_clima_campanhas_empresa_select on public.ia_clima_campanhas;
create policy ia_clima_campanhas_empresa_select
on public.ia_clima_campanhas for select to authenticated
using (empresa_id = (select u.empresa_id from public.usuarios u where u.id = (select auth.uid())));

drop policy if exists ia_clima_perguntas_empresa_select on public.ia_clima_perguntas;
create policy ia_clima_perguntas_empresa_select
on public.ia_clima_perguntas for select to authenticated
using (exists (
  select 1
  from public.ia_clima_campanhas c
  join public.usuarios u on u.id = (select auth.uid())
  where c.id = campanha_id and c.empresa_id = u.empresa_id
));

drop policy if exists ia_clima_respostas_self_select on public.ia_clima_respostas;
create policy ia_clima_respostas_self_select
on public.ia_clima_respostas for select to authenticated
using (usuario_id = (select auth.uid()));

drop policy if exists ia_clima_respostas_self_insert on public.ia_clima_respostas;
create policy ia_clima_respostas_self_insert
on public.ia_clima_respostas for insert to authenticated
with check (usuario_id = (select auth.uid()));

drop policy if exists ia_acessos_dominio_self_select on public.ia_acessos_dominio;
create policy ia_acessos_dominio_self_select
on public.ia_acessos_dominio for select to authenticated
using (usuario_id = (select auth.uid()));

-- ia_auditoria_dados não recebe policies para authenticated:
-- leitura/escrita ficam restritas ao backend/service role.

-- Reforço de tenant: além do usuario_id, o empresa_id informado deve ser o mesmo do perfil autenticado.
drop policy if exists ia_pessoas_preferencias_self_insert on public.ia_pessoas_preferencias;
create policy ia_pessoas_preferencias_self_insert
on public.ia_pessoas_preferencias for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and empresa_id = (select u.empresa_id from public.usuarios u where u.id = (select auth.uid()))
);

drop policy if exists ia_pessoas_preferencias_self_update on public.ia_pessoas_preferencias;
create policy ia_pessoas_preferencias_self_update
on public.ia_pessoas_preferencias for update to authenticated
using (
  usuario_id = (select auth.uid())
  and empresa_id = (select u.empresa_id from public.usuarios u where u.id = (select auth.uid()))
)
with check (
  usuario_id = (select auth.uid())
  and empresa_id = (select u.empresa_id from public.usuarios u where u.id = (select auth.uid()))
);

drop policy if exists ia_diario_privado_self_insert on public.ia_diario_privado;
create policy ia_diario_privado_self_insert
on public.ia_diario_privado for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and empresa_id = (select u.empresa_id from public.usuarios u where u.id = (select auth.uid()))
);

drop policy if exists ia_feedback_colaborador_self_insert on public.ia_feedback_colaborador;
create policy ia_feedback_colaborador_self_insert
on public.ia_feedback_colaborador for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and empresa_id = (select u.empresa_id from public.usuarios u where u.id = (select auth.uid()))
);

drop policy if exists ia_clima_respostas_self_insert on public.ia_clima_respostas;
create policy ia_clima_respostas_self_insert
on public.ia_clima_respostas for insert to authenticated
with check (
  usuario_id = (select auth.uid())
  and empresa_id = (select u.empresa_id from public.usuarios u where u.id = (select auth.uid()))
  and exists (
    select 1
    from public.ia_clima_campanhas c
    where c.id = campanha_id and c.empresa_id = ia_clima_respostas.empresa_id
  )
);