-- Atlas One — colaboração de tarefas + notificações persistentes V1
--
-- Objetivos:
-- 1. registrar quem solicitou/atribuiu uma tarefa;
-- 2. substituir a RLS temporária permissiva de tarefas por acesso do próprio dono;
-- 3. criar notificações persistentes por destinatário;
-- 4. criar preferências de som/categorias por usuário;
-- 5. notificar automaticamente tarefa atribuída e convite de agenda.
--
-- A atribuição cross-user é feita por API server-side com service role.

alter table public.tarefas
  add column if not exists solicitante_id uuid references public.usuarios(id) on delete set null,
  add column if not exists solicitante_nome text,
  add column if not exists atribuida_em timestamptz,
  add column if not exists prioridade text not null default 'normal';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tarefas_prioridade_check'
      and conrelid = 'public.tarefas'::regclass
  ) then
    alter table public.tarefas
      add constraint tarefas_prioridade_check
      check (prioridade in ('baixa', 'normal', 'alta', 'urgente'));
  end if;
end $$;

create index if not exists tarefas_usuario_data_aberta_idx
  on public.tarefas(usuario_id, data_hora)
  where concluida_em is null;

create index if not exists tarefas_solicitante_idx
  on public.tarefas(solicitante_id, created_at desc)
  where solicitante_id is not null;

-- A política temporária permitia acesso total entre usuários. A partir desta
-- migration, o browser só opera tarefas/colunas do próprio usuário. A API
-- server-side usa service role para atribuição cross-user.
drop policy if exists "acesso_total_temporario" on public.tarefas;
drop policy if exists "tarefas_select_proprias" on public.tarefas;
drop policy if exists "tarefas_insert_proprias" on public.tarefas;
drop policy if exists "tarefas_update_proprias" on public.tarefas;
drop policy if exists "tarefas_delete_proprias" on public.tarefas;

create policy "tarefas_select_proprias" on public.tarefas
  for select using (usuario_id = auth.uid());

create policy "tarefas_insert_proprias" on public.tarefas
  for insert with check (
    usuario_id = auth.uid()
    and (solicitante_id is null or solicitante_id = auth.uid())
    and exists (
      select 1 from public.tarefa_colunas c
      where c.id = coluna_id and c.usuario_id = auth.uid()
    )
  );

create policy "tarefas_update_proprias" on public.tarefas
  for update using (usuario_id = auth.uid())
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from public.tarefa_colunas c
      where c.id = coluna_id and c.usuario_id = auth.uid()
    )
  );

create policy "tarefas_delete_proprias" on public.tarefas
  for delete using (usuario_id = auth.uid());

drop policy if exists "acesso_total_temporario" on public.tarefa_colunas;
drop policy if exists "tarefa_colunas_select_proprias" on public.tarefa_colunas;
drop policy if exists "tarefa_colunas_insert_proprias" on public.tarefa_colunas;
drop policy if exists "tarefa_colunas_update_proprias" on public.tarefa_colunas;
drop policy if exists "tarefa_colunas_delete_proprias" on public.tarefa_colunas;

create policy "tarefa_colunas_select_proprias" on public.tarefa_colunas
  for select using (usuario_id = auth.uid());
create policy "tarefa_colunas_insert_proprias" on public.tarefa_colunas
  for insert with check (usuario_id = auth.uid());
create policy "tarefa_colunas_update_proprias" on public.tarefa_colunas
  for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "tarefa_colunas_delete_proprias" on public.tarefa_colunas
  for delete using (usuario_id = auth.uid());

-- Metadados de atribuição não podem ser adulterados pelo dono da tarefa via
-- browser depois da criação. Service role continua apta a operações administrativas.
create or replace function public.proteger_metadados_atribuicao_tarefa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and (
    new.usuario_id is distinct from old.usuario_id
    or new.solicitante_id is distinct from old.solicitante_id
    or new.solicitante_nome is distinct from old.solicitante_nome
    or new.atribuida_em is distinct from old.atribuida_em
  ) then
    raise exception 'Metadados de atribuição da tarefa são imutáveis';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_metadados_atribuicao_tarefa on public.tarefas;
create trigger trg_proteger_metadados_atribuicao_tarefa
before update on public.tarefas
for each row execute function public.proteger_metadados_atribuicao_tarefa();

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  categoria text not null,
  tipo text not null,
  titulo text not null,
  mensagem text,
  href text,
  origem_tipo text,
  origem_id text,
  criado_por_id uuid references public.usuarios(id) on delete set null,
  criado_por_nome text,
  lida_em timestamptz,
  created_at timestamptz not null default now(),
  constraint notificacoes_categoria_check check (categoria in ('tarefas','agenda','chat','operacao'))
);

create index if not exists notificacoes_usuario_data_idx
  on public.notificacoes(usuario_id, created_at desc);
create index if not exists notificacoes_usuario_nao_lida_idx
  on public.notificacoes(usuario_id, created_at desc)
  where lida_em is null;
create unique index if not exists notificacoes_origem_dedupe_idx
  on public.notificacoes(usuario_id, origem_tipo, origem_id)
  where origem_tipo is not null and origem_id is not null;

alter table public.notificacoes enable row level security;
drop policy if exists "notificacoes_select_proprias" on public.notificacoes;
drop policy if exists "notificacoes_update_proprias" on public.notificacoes;
drop policy if exists "notificacoes_delete_proprias" on public.notificacoes;
create policy "notificacoes_select_proprias" on public.notificacoes
  for select using (usuario_id = auth.uid());
create policy "notificacoes_update_proprias" on public.notificacoes
  for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "notificacoes_delete_proprias" on public.notificacoes
  for delete using (usuario_id = auth.uid());

create table if not exists public.notificacao_preferencias (
  usuario_id uuid primary key references public.usuarios(id) on delete cascade,
  som_ativo boolean not null default false,
  som_volume numeric(4,3) not null default 0.600,
  tarefas boolean not null default true,
  agenda boolean not null default true,
  chat boolean not null default true,
  operacao boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint notificacao_preferencias_volume_check check (som_volume >= 0 and som_volume <= 1)
);

alter table public.notificacao_preferencias enable row level security;
drop policy if exists "notificacao_preferencias_select_proprias" on public.notificacao_preferencias;
drop policy if exists "notificacao_preferencias_insert_proprias" on public.notificacao_preferencias;
drop policy if exists "notificacao_preferencias_update_proprias" on public.notificacao_preferencias;
create policy "notificacao_preferencias_select_proprias" on public.notificacao_preferencias
  for select using (usuario_id = auth.uid());
create policy "notificacao_preferencias_insert_proprias" on public.notificacao_preferencias
  for insert with check (usuario_id = auth.uid());
create policy "notificacao_preferencias_update_proprias" on public.notificacao_preferencias
  for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create or replace function public.notificar_tarefa_atribuida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.solicitante_id is not null and new.solicitante_id <> new.usuario_id then
    insert into public.notificacoes (
      usuario_id, categoria, tipo, titulo, mensagem, href,
      origem_tipo, origem_id, criado_por_id, criado_por_nome
    ) values (
      new.usuario_id,
      'tarefas',
      'tarefa_atribuida',
      coalesce(new.solicitante_nome, 'Outro usuário') || ' criou uma tarefa para você',
      new.titulo,
      '/tarefas',
      'tarefa_atribuida',
      new.id::text,
      new.solicitante_id,
      new.solicitante_nome
    ) on conflict (usuario_id, origem_tipo, origem_id) where origem_tipo is not null and origem_id is not null do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notificar_tarefa_atribuida on public.tarefas;
create trigger trg_notificar_tarefa_atribuida
after insert on public.tarefas
for each row execute function public.notificar_tarefa_atribuida();

create or replace function public.notificar_convite_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  evento_row public.eventos%rowtype;
  criador_nome text;
begin
  select * into evento_row from public.eventos where id = new.evento_id;
  if evento_row.id is null or evento_row.usuario_id = new.usuario_id then
    return new;
  end if;
  select nome into criador_nome from public.usuarios where id = evento_row.usuario_id;

  insert into public.notificacoes (
    usuario_id, categoria, tipo, titulo, mensagem, href,
    origem_tipo, origem_id, criado_por_id, criado_por_nome
  ) values (
    new.usuario_id,
    'agenda',
    'convite_agenda',
    coalesce(criador_nome, 'Outro usuário') || ' convidou você para um compromisso',
    evento_row.titulo,
    '/',
    'evento_convite',
    new.id::text,
    evento_row.usuario_id,
    criador_nome
  ) on conflict (usuario_id, origem_tipo, origem_id) where origem_tipo is not null and origem_id is not null do nothing;
  return new;
end;
$$;

drop trigger if exists trg_notificar_convite_evento on public.evento_convidados;
create trigger trg_notificar_convite_evento
after insert on public.evento_convidados
for each row execute function public.notificar_convite_evento();

-- Realtime para alertas instantâneos no sino. Evita erro se já estiver publicado.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end $$;
