-- Conclusão individual de compromissos da agenda.
-- A conclusão não remove o evento nem altera o convite dos demais usuários.
create table if not exists public.evento_conclusoes_usuario (
  evento_id uuid not null references public.eventos(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  empresa_id uuid not null default private.current_empresa_id(),
  concluida_em timestamptz not null default now(),
  primary key (evento_id, usuario_id)
);

create index if not exists evento_conclusoes_usuario_historico_idx
  on public.evento_conclusoes_usuario (usuario_id, concluida_em desc);

alter table public.evento_conclusoes_usuario enable row level security;

revoke all on public.evento_conclusoes_usuario from public, anon;
grant select, insert, delete on public.evento_conclusoes_usuario to authenticated;
grant all on public.evento_conclusoes_usuario to service_role;

-- Reforça o tenant e autoriza apenas o dono do evento ou usuário convidado.
-- Cada usuário lê, conclui e reabre somente a própria pendência.
drop policy if exists evento_conclusoes_usuario_select on public.evento_conclusoes_usuario;
create policy evento_conclusoes_usuario_select
  on public.evento_conclusoes_usuario for select to authenticated
  using (
    usuario_id = auth.uid()
    and empresa_id = private.current_empresa_id()
    and exists (
      select 1 from public.eventos e
      where e.id = evento_id
        and e.empresa_id = empresa_id
        and (e.usuario_id = auth.uid() or private.is_convidado_evento(e.id))
    )
  );

drop policy if exists evento_conclusoes_usuario_insert on public.evento_conclusoes_usuario;
create policy evento_conclusoes_usuario_insert
  on public.evento_conclusoes_usuario for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and empresa_id = private.current_empresa_id()
    and exists (
      select 1 from public.eventos e
      where e.id = evento_id
        and e.empresa_id = empresa_id
        and (e.usuario_id = auth.uid() or private.is_convidado_evento(e.id))
    )
  );

drop policy if exists evento_conclusoes_usuario_delete on public.evento_conclusoes_usuario;
create policy evento_conclusoes_usuario_delete
  on public.evento_conclusoes_usuario for delete to authenticated
  using (
    usuario_id = auth.uid()
    and empresa_id = private.current_empresa_id()
    and exists (
      select 1 from public.eventos e
      where e.id = evento_id
        and e.empresa_id = empresa_id
        and (e.usuario_id = auth.uid() or private.is_convidado_evento(e.id))
    )
  );

comment on table public.evento_conclusoes_usuario is
  'Conclusão individual de compromissos na Home, preservando eventos e convites.';
