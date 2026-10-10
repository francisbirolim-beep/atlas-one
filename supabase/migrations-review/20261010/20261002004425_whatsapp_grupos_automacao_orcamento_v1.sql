-- WhatsApp grupos + automacao de entrada de orcamento.
-- Mantem conversas individuais por telefone e adiciona identidade propria para grupos.

alter table public.atendimento_conversas
  add column if not exists whatsapp_chat_tipo text not null default 'contato',
  add column if not exists whatsapp_chat_jid text,
  add column if not exists grupo_nome text,
  add column if not exists ocultar_da_caixa boolean not null default false;

update public.atendimento_conversas
set whatsapp_chat_tipo = coalesce(nullif(whatsapp_chat_tipo, ''), 'contato'),
    whatsapp_chat_jid = coalesce(
      whatsapp_chat_jid,
      case
        when telefone is not null and telefone <> '' then regexp_replace(telefone, '[^0-9]', '', 'g') || '@s.whatsapp.net'
        else null
      end
    )
where canal = 'whatsapp';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'atendimento_conversas_whatsapp_chat_tipo_check'
      and conrelid = 'public.atendimento_conversas'::regclass
  ) then
    alter table public.atendimento_conversas
      add constraint atendimento_conversas_whatsapp_chat_tipo_check
      check (whatsapp_chat_tipo in ('contato', 'grupo'));
  end if;
end $$;

create index if not exists atendimento_conversas_chat_jid_idx
  on public.atendimento_conversas (empresa_id, whatsapp_canal_id, whatsapp_chat_jid, ultima_mensagem_em desc);

create index if not exists atendimento_conversas_caixa_whatsapp_idx
  on public.atendimento_conversas (empresa_id, ocultar_da_caixa, ultima_mensagem_em desc)
  where canal = 'whatsapp';

-- Preserva historico antigo, mas tira da caixa somente conversas que nasceram exclusivamente de Status/Stories.
update public.atendimento_conversas c
set ocultar_da_caixa = true,
    updated_at = now()
where c.canal = 'whatsapp'
  and exists (
    select 1
    from public.atendimento_mensagens m
    where m.conversa_id = c.id
      and m.payload->>'remoteJid' = 'status@broadcast'
  )
  and not exists (
    select 1
    from public.atendimento_mensagens m
    where m.conversa_id = c.id
      and (
        m.direcao = 'saida'
        or coalesce(m.payload->>'remoteJid','') <> 'status@broadcast'
      )
  );

create table if not exists public.atendimento_whatsapp_contatos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  whatsapp_canal_id uuid not null references public.atendimento_whatsapp_canais(id) on delete cascade,
  contato_jid text not null,
  telefone text,
  nome text,
  nome_verificado text,
  ativo boolean not null default true,
  sincronizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, whatsapp_canal_id, contato_jid)
);

create table if not exists public.atendimento_whatsapp_grupos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  whatsapp_canal_id uuid not null references public.atendimento_whatsapp_canais(id) on delete cascade,
  grupo_jid text not null,
  nome text not null,
  participantes integer not null default 0,
  ativo boolean not null default true,
  sincronizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, whatsapp_canal_id, grupo_jid)
);

create table if not exists public.atendimento_whatsapp_grupo_automacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  grupo_id uuid not null references public.atendimento_whatsapp_grupos(id) on delete cascade,
  tipo text not null default 'orcamento',
  responsavel_id uuid references public.usuarios(id) on delete set null,
  ativo boolean not null default true,
  criar_rascunho boolean not null default true,
  criar_tarefa boolean not null default true,
  janela_agregacao_minutos integer not null default 5,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, grupo_id, tipo),
  check (tipo in ('orcamento')),
  check (janela_agregacao_minutos between 1 and 120)
);

create table if not exists public.atendimento_whatsapp_intakes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  automacao_id uuid not null references public.atendimento_whatsapp_grupo_automacoes(id) on delete cascade,
  grupo_id uuid not null references public.atendimento_whatsapp_grupos(id) on delete cascade,
  conversa_id uuid references public.atendimento_conversas(id) on delete set null,
  participante_jid text,
  participante_telefone text,
  participante_nome text,
  status text not null default 'aberto',
  orcamento_id uuid references public.orcamentos(id) on delete set null,
  tarefa_id uuid references public.tarefas(id) on delete set null,
  conteudo_bruto text not null default '',
  mensagens_ids jsonb not null default '[]'::jsonb,
  anexos jsonb not null default '[]'::jsonb,
  ai_status text not null default 'pendente',
  ai_session_id text,
  ai_resultado jsonb,
  ai_erro text,
  ai_processado_em timestamptz,
  primeira_mensagem_em timestamptz not null default now(),
  ultima_mensagem_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('aberto', 'rascunho_criado', 'processado', 'erro')),
  check (ai_status in ('pendente', 'processando', 'concluido', 'erro'))
);

create index if not exists atendimento_whatsapp_contatos_canal_idx
  on public.atendimento_whatsapp_contatos (empresa_id, whatsapp_canal_id, ativo, nome);

create index if not exists atendimento_whatsapp_grupos_canal_idx
  on public.atendimento_whatsapp_grupos (empresa_id, whatsapp_canal_id, ativo, nome);

create index if not exists atendimento_whatsapp_intakes_abertos_idx
  on public.atendimento_whatsapp_intakes (
    empresa_id, automacao_id, participante_jid, status, ultima_mensagem_em desc
  );

alter table public.atendimento_whatsapp_contatos enable row level security;
alter table public.atendimento_whatsapp_grupos enable row level security;
alter table public.atendimento_whatsapp_grupo_automacoes enable row level security;
alter table public.atendimento_whatsapp_intakes enable row level security;

revoke all on public.atendimento_whatsapp_contatos from authenticated;
revoke all on public.atendimento_whatsapp_grupos from authenticated;
revoke all on public.atendimento_whatsapp_grupo_automacoes from authenticated;
revoke all on public.atendimento_whatsapp_intakes from authenticated;

grant select on public.atendimento_whatsapp_contatos to authenticated;
grant select on public.atendimento_whatsapp_grupos to authenticated;
grant select on public.atendimento_whatsapp_grupo_automacoes to authenticated;
grant select on public.atendimento_whatsapp_intakes to authenticated;

drop policy if exists atendimento_whatsapp_contatos_select_v1 on public.atendimento_whatsapp_contatos;
create policy atendimento_whatsapp_contatos_select_v1
on public.atendimento_whatsapp_contatos for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (
    (select private.is_master_atlas())
    or exists (
      select 1
      from public.atendimento_whatsapp_canais c
      where c.id = whatsapp_canal_id
        and c.empresa_id = empresa_id
        and c.ativo = true
        and (
          c.principal = true
          or c.usuario_id = (select auth.uid())
          or exists (
            select 1
            from public.atendimento_whatsapp_permissoes p
            where p.empresa_id = empresa_id
              and p.canal_id = c.id
              and p.usuario_id = (select auth.uid())
              and (
                p.pode_visualizar = true
                or p.pode_atender = true
                or p.pode_transferir = true
                or p.pode_supervisionar = true
              )
          )
        )
    )
  )
);

drop policy if exists atendimento_whatsapp_grupos_select_v1 on public.atendimento_whatsapp_grupos;
create policy atendimento_whatsapp_grupos_select_v1
on public.atendimento_whatsapp_grupos for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (
    (select private.is_master_atlas())
    or exists (
      select 1
      from public.atendimento_whatsapp_canais c
      where c.id = whatsapp_canal_id
        and c.empresa_id = empresa_id
        and c.ativo = true
        and (
          c.principal = true
          or c.usuario_id = (select auth.uid())
          or exists (
            select 1
            from public.atendimento_whatsapp_permissoes p
            where p.empresa_id = empresa_id
              and p.canal_id = c.id
              and p.usuario_id = (select auth.uid())
              and (
                p.pode_visualizar = true
                or p.pode_atender = true
                or p.pode_transferir = true
                or p.pode_supervisionar = true
              )
          )
        )
    )
  )
);

drop policy if exists atendimento_whatsapp_grupo_automacoes_select_v1 on public.atendimento_whatsapp_grupo_automacoes;
create policy atendimento_whatsapp_grupo_automacoes_select_v1
on public.atendimento_whatsapp_grupo_automacoes for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (select private.is_master_atlas())
);

drop policy if exists atendimento_whatsapp_intakes_select_v1 on public.atendimento_whatsapp_intakes;
create policy atendimento_whatsapp_intakes_select_v1
on public.atendimento_whatsapp_intakes for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (
    (select private.is_master_atlas())
    or exists (
      select 1
      from public.tarefas t
      where t.id = tarefa_id
        and t.usuario_id = (select auth.uid())
    )
  )
);

comment on table public.atendimento_whatsapp_contatos is
  'Diretorio de contatos sincronizados por numero WhatsApp, respeitando permissao do canal.';

comment on table public.atendimento_whatsapp_grupos is
  'Grupos sincronizados de cada numero WhatsApp conectado ao Atlas. Status/Stories nao entram aqui.';

comment on table public.atendimento_whatsapp_grupo_automacoes is
  'Automacoes explicitas por grupo WhatsApp. Ex.: Grupo Orcamentos cria rascunho e tarefa.';

comment on table public.atendimento_whatsapp_intakes is
  'Agrupa mensagens encaminhadas a grupos operacionais antes/depois da estruturacao por IA.';