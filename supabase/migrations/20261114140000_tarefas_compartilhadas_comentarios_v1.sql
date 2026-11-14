-- V1 aditiva: um grupo une as cópias pessoais da mesma tarefa.
-- Não altera os cartões atuais, colunas, dados antigos nem políticas de tarefas.
alter table public.tarefas
  add column if not exists tarefa_grupo_id uuid,
  add column if not exists responsaveis_nomes text[] not null default '{}';

create index if not exists tarefas_grupo_empresa_idx
  on public.tarefas (empresa_id, tarefa_grupo_id)
  where tarefa_grupo_id is not null;

create table if not exists public.tarefa_comentarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  tarefa_grupo_id uuid not null,
  usuario_id uuid not null references public.usuarios(id),
  usuario_nome text not null,
  comentario text not null check (length(trim(comentario)) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists tarefa_comentarios_grupo_idx
  on public.tarefa_comentarios (empresa_id, tarefa_grupo_id, created_at);
alter table public.tarefa_comentarios enable row level security;
revoke all on public.tarefa_comentarios from public, anon;
grant select, insert on public.tarefa_comentarios to authenticated;
grant all on public.tarefa_comentarios to service_role;

drop policy if exists tarefa_comentarios_select on public.tarefa_comentarios;
create policy tarefa_comentarios_select on public.tarefa_comentarios
for select to authenticated using (
  empresa_id = private.current_empresa_id()
  and exists (
    select 1 from public.tarefas t
    where t.tarefa_grupo_id = tarefa_comentarios.tarefa_grupo_id
      and t.usuario_id = auth.uid()
      and t.empresa_id = tarefa_comentarios.empresa_id
  )
);
drop policy if exists tarefa_comentarios_insert on public.tarefa_comentarios;
create policy tarefa_comentarios_insert on public.tarefa_comentarios
for insert to authenticated with check (
  usuario_id = auth.uid()
  and empresa_id = private.current_empresa_id()
  and exists (
    select 1 from public.tarefas t
    where t.tarefa_grupo_id = tarefa_comentarios.tarefa_grupo_id
      and t.usuario_id = auth.uid()
      and t.empresa_id = tarefa_comentarios.empresa_id
  )
);

-- A coluna é particular de cada Kanban. Replicar a ETAPA, não o UUID da coluna.
-- A sincronização é feita no banco para manter tudo consistente entre sessões.
create or replace function public.sincronizar_etapa_tarefa_compartilhada()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  nome_etapa text;
  etapa text;
  destino record;
  nova_coluna_id uuid;
begin
  if new.tarefa_grupo_id is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  if new.coluna_id is not distinct from old.coluna_id
     and new.concluida_em is not distinct from old.concluida_em then
    return new;
  end if;
  select lower(nome) into nome_etapa
    from public.tarefa_colunas where id = new.coluna_id
    and usuario_id = new.usuario_id and empresa_id = new.empresa_id;
  if nome_etapa is null then return new; end if;

  etapa := case
    when new.concluida_em is not null or nome_etapa like '%conclu%' or nome_etapa like '%finaliz%' then 'concluido'
    when nome_etapa like '%andamento%' or nome_etapa like '%execuc%' then 'andamento'
    when nome_etapa like '%aguard%' or nome_etapa like '%espera%' then 'aguardando'
    else 'fazer' end;

  -- Não replicar uma alteração que apenas reabriu sem escolher nova etapa.
  if new.concluida_em is null and old.concluida_em is not null and etapa = 'concluido' then
    etapa := 'fazer';
  end if;

  for destino in
    select t.id, t.usuario_id
      from public.tarefas t
     where t.empresa_id = new.empresa_id
       and t.tarefa_grupo_id = new.tarefa_grupo_id
       and t.id <> new.id
  loop
    select c.id into nova_coluna_id
      from public.tarefa_colunas c
     where c.usuario_id = destino.usuario_id
       and c.empresa_id = new.empresa_id
     order by
       case
         when etapa = 'concluido' and (lower(c.nome) like '%conclu%' or lower(c.nome) like '%finaliz%') then 0
         when etapa = 'andamento' and (lower(c.nome) like '%andamento%' or lower(c.nome) like '%execuc%') then 0
         when etapa = 'aguardando' and (lower(c.nome) like '%aguard%' or lower(c.nome) like '%espera%') then 0
         when etapa = 'fazer' and (lower(c.nome) like '%fazer%' or lower(c.nome) like '%iniciar%') then 0
         else 1 end,
       c.ordem
     limit 1;
    if nova_coluna_id is not null then
      update public.tarefas
        set coluna_id = nova_coluna_id,
            concluida_em = case when etapa = 'concluido' then coalesce(new.concluida_em, now()) else null end
      where id = destino.id and empresa_id = new.empresa_id;
    end if;
  end loop;

  -- Todos os envolvidos, menos quem concluiu, recebem aviso de conclusão.
  if new.concluida_em is not null and old.concluida_em is null then
    insert into public.notificacoes (
      usuario_id, empresa_id, categoria, tipo, titulo, mensagem, href,
      origem_tipo, origem_id, criado_por_id
    )
    select distinct t.usuario_id, new.empresa_id, 'tarefas', 'tarefa_concluida',
      'Tarefa concluída', new.titulo, '/tarefas',
      'tarefa_compartilhada_concluida', new.tarefa_grupo_id::text, new.usuario_id
    from public.tarefas t
    where t.empresa_id = new.empresa_id
      and t.tarefa_grupo_id = new.tarefa_grupo_id
      and t.usuario_id <> new.usuario_id
    on conflict (usuario_id, origem_tipo, origem_id)
      where origem_tipo is not null and origem_id is not null do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_sincronizar_etapa_tarefa_compartilhada on public.tarefas;
create trigger trg_sincronizar_etapa_tarefa_compartilhada
after update of coluna_id, concluida_em on public.tarefas
for each row execute function public.sincronizar_etapa_tarefa_compartilhada();

comment on column public.tarefas.tarefa_grupo_id is
  'Tarefa compartilhada: cópias sincronizadas do mesmo card em Kanbans pessoais distintos';


-- Publicação protegida por RLS: permite mudança imediata no Kanban de cada usuário.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='tarefas') then
    alter publication supabase_realtime add table public.tarefas;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='tarefa_comentarios') then
    alter publication supabase_realtime add table public.tarefa_comentarios;
  end if;
end $$;
