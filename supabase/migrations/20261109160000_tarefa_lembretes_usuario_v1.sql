-- Controle individual de reapresentação de tarefas em aberto.
-- Não altera as tarefas, seus históricos, convites ou notificações existentes.
create table if not exists public.tarefa_lembretes_usuario (
  tarefa_id uuid primary key references public.tarefas(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  empresa_id uuid not null default private.current_empresa_id(),
  ultimo_aviso_em timestamptz,
  adiada_ate timestamptz,
  atualizado_em timestamptz not null default now()
);

create index if not exists tarefa_lembretes_usuario_usuario_idx
  on public.tarefa_lembretes_usuario (usuario_id, adiada_ate);

alter table public.tarefa_lembretes_usuario enable row level security;
revoke all on public.tarefa_lembretes_usuario from public, anon;
grant select, insert, update on public.tarefa_lembretes_usuario to authenticated;
grant all on public.tarefa_lembretes_usuario to service_role;

-- Nunca permite ler ou mudar lembretes de outra pessoa ou empresa.
drop policy if exists tarefa_lembretes_usuario_select on public.tarefa_lembretes_usuario;
create policy tarefa_lembretes_usuario_select
  on public.tarefa_lembretes_usuario for select to authenticated using (
    usuario_id = auth.uid() and empresa_id = private.current_empresa_id()
    and exists (
      select 1 from public.tarefas t
      where t.id = tarefa_id and t.usuario_id = auth.uid()
        and t.empresa_id = public.tarefa_lembretes_usuario.empresa_id
    )
  );

drop policy if exists tarefa_lembretes_usuario_insert on public.tarefa_lembretes_usuario;
create policy tarefa_lembretes_usuario_insert
  on public.tarefa_lembretes_usuario for insert to authenticated with check (
    usuario_id = auth.uid() and empresa_id = private.current_empresa_id()
    and exists (
      select 1 from public.tarefas t
      where t.id = tarefa_id and t.usuario_id = auth.uid()
        and t.empresa_id = public.tarefa_lembretes_usuario.empresa_id
    )
  );

drop policy if exists tarefa_lembretes_usuario_update on public.tarefa_lembretes_usuario;
create policy tarefa_lembretes_usuario_update
  on public.tarefa_lembretes_usuario for update to authenticated
  using (
    usuario_id = auth.uid() and empresa_id = private.current_empresa_id()
    and exists (
      select 1 from public.tarefas t
      where t.id = tarefa_id and t.usuario_id = auth.uid()
        and t.empresa_id = public.tarefa_lembretes_usuario.empresa_id
    )
  )
  with check (
    usuario_id = auth.uid() and empresa_id = private.current_empresa_id()
    and exists (
      select 1 from public.tarefas t
      where t.id = tarefa_id and t.usuario_id = auth.uid()
        and t.empresa_id = public.tarefa_lembretes_usuario.empresa_id
    )
  );

comment on table public.tarefa_lembretes_usuario is
  'Último aviso e adiamento por usuário para reapresentar tarefas não concluídas.';
