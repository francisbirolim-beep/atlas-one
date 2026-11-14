-- Regras recorrentes independentes dos cards já concluídos.
-- Cron em background materializa só as ocorrências próximas, sem reabrir histórico.
create table if not exists public.atlas_recorrencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  criador_id uuid not null references public.usuarios(id),
  tipo_registro text not null check (tipo_registro in ('tarefa','agenda')),
  titulo text not null check (length(trim(titulo)) between 1 and 300),
  descricao text,
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta','urgente')),
  responsaveis_ids uuid[] not null default '{}',
  convidados_ids uuid[] not null default '{}',
  local text,
  base_data date not null,
  hora_inicio time not null,
  duracao_minutos integer not null default 60 check (duracao_minutos between 1 and 1440),
  frequencia text not null check (frequencia in ('diaria','semanal','mensal','dia_util_mes','anual')),
  dias_semana integer[] not null default '{}',
  dia_mes integer check (dia_mes between 1 and 31),
  n_dia_util integer check (n_dia_util between 1 and 23),
  proxima_data date not null,
  ate_data date,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists atlas_recorrencias_pendentes_idx
 on public.atlas_recorrencias (proxima_data) where ativo = true;
alter table public.atlas_recorrencias enable row level security;
revoke all on public.atlas_recorrencias from public, anon;
grant select on public.atlas_recorrencias to authenticated;
grant all on public.atlas_recorrencias to service_role;
drop policy if exists atlas_recorrencias_dono_select on public.atlas_recorrencias;
create policy atlas_recorrencias_dono_select on public.atlas_recorrencias
  for select to authenticated using (
    criador_id = auth.uid() and empresa_id = private.current_empresa_id()
  );

create table if not exists public.atlas_recorrencia_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  recorrencia_id uuid not null references public.atlas_recorrencias(id) on delete cascade,
  data_local date not null,
  status text not null default 'pendente' check (status in ('pendente','criada')),
  created_at timestamptz not null default now(),
  unique (recorrencia_id, data_local)
);
create index if not exists atlas_recorrencia_ocorrencias_pendentes_idx
 on public.atlas_recorrencia_ocorrencias(status) where status = 'pendente';
alter table public.atlas_recorrencia_ocorrencias enable row level security;
revoke all on public.atlas_recorrencia_ocorrencias from public, anon, authenticated;
grant all on public.atlas_recorrencia_ocorrencias to service_role;

alter table public.tarefas
  add column if not exists recorrencia_regra_id uuid references public.atlas_recorrencias(id) on delete set null,
  add column if not exists recorrencia_data date;
create unique index if not exists tarefas_recorrencia_unica_idx
  on public.tarefas (recorrencia_regra_id, recorrencia_data, usuario_id);

alter table public.eventos
  add column if not exists recorrencia_regra_id uuid references public.atlas_recorrencias(id) on delete set null,
  add column if not exists recorrencia_data date;
create unique index if not exists eventos_recorrencia_unica_idx
  on public.eventos (recorrencia_regra_id, recorrencia_data);

-- Calendário corporativo para exceções locais, municipais e bancárias.
-- Sem cadastro local, calcula sábados/domingos e feriados nacionais fixos.
create table if not exists public.atlas_feriados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  data date not null,
  descricao text not null,
  unique (empresa_id, data)
);
alter table public.atlas_feriados enable row level security;
revoke all on public.atlas_feriados from public, anon;
grant select on public.atlas_feriados to authenticated;
grant all on public.atlas_feriados to service_role;
drop policy if exists atlas_feriados_empresa_select on public.atlas_feriados;
create policy atlas_feriados_empresa_select on public.atlas_feriados
 for select to authenticated using (empresa_id = private.current_empresa_id());

-- Dados de vínculo só podem ser criados/alterados pela API autenticada.
-- Impede que um usuário associe uma tarefa própria a um grupo alheio.
create or replace function public.proteger_vinculo_tarefa_compartilhada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if tg_op = 'INSERT' then
    if new.tarefa_grupo_id is not null or new.recorrencia_regra_id is not null
      or new.recorrencia_data is not null or array_length(new.responsaveis_nomes, 1) is not null then
      raise exception 'Vínculo compartilhado deve ser criado por API autenticada';
    end if;
  else
    if new.tarefa_grupo_id is distinct from old.tarefa_grupo_id
      or new.responsaveis_nomes is distinct from old.responsaveis_nomes
      or new.recorrencia_regra_id is distinct from old.recorrencia_regra_id
      or new.recorrencia_data is distinct from old.recorrencia_data then
      raise exception 'Metadados de grupo e recorrência são imutáveis';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_proteger_vinculo_tarefa_compartilhada on public.tarefas;
create trigger trg_proteger_vinculo_tarefa_compartilhada
before insert or update on public.tarefas
for each row execute function public.proteger_vinculo_tarefa_compartilhada();

-- Nome exibido nos comentários sempre vem da identidade autenticada.
create or replace function public.identificar_autor_comentario_tarefa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select u.nome into new.usuario_nome from public.usuarios u
   where u.id = new.usuario_id and u.empresa_id = new.empresa_id;
  if new.usuario_nome is null then raise exception 'Autor da tarefa não encontrado'; end if;
  return new;
end $$;
drop trigger if exists trg_identificar_autor_comentario_tarefa on public.tarefa_comentarios;
create trigger trg_identificar_autor_comentario_tarefa
before insert on public.tarefa_comentarios
for each row execute function public.identificar_autor_comentario_tarefa();

-- Apenas gatilhos internos podem acionar as funções privilegiadas.
revoke execute on function public.sincronizar_etapa_tarefa_compartilhada() from public, anon, authenticated;
revoke execute on function public.proteger_vinculo_tarefa_compartilhada() from public, anon, authenticated;
revoke execute on function public.identificar_autor_comentario_tarefa() from public, anon, authenticated;


-- Histórico da etapa alterada pelo usuário, independente da sincronização visual.
create table if not exists public.tarefa_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  tarefa_grupo_id uuid not null,
  tarefa_id uuid not null references public.tarefas(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id),
  usuario_nome text not null,
  coluna_nome text not null,
  concluida boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tarefa_movimentacoes_grupo_idx
  on public.tarefa_movimentacoes (empresa_id, tarefa_grupo_id, created_at desc);
alter table public.tarefa_movimentacoes enable row level security;
revoke all on public.tarefa_movimentacoes from public, anon;
grant select on public.tarefa_movimentacoes to authenticated;
grant all on public.tarefa_movimentacoes to service_role;
drop policy if exists tarefa_movimentacoes_select on public.tarefa_movimentacoes;
create policy tarefa_movimentacoes_select on public.tarefa_movimentacoes
for select to authenticated using (
  empresa_id = private.current_empresa_id() and exists (
    select 1 from public.tarefas t where t.empresa_id=tarefa_movimentacoes.empresa_id
      and t.tarefa_grupo_id=tarefa_movimentacoes.tarefa_grupo_id and t.usuario_id=auth.uid()
  )
);

create or replace function public.registrar_movimentacao_tarefa_compartilhada()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_usuario uuid;
  v_nome text;
  v_coluna text;
begin
  if new.tarefa_grupo_id is null or pg_trigger_depth() > 1 then return new; end if;
  if new.coluna_id is not distinct from old.coluna_id
    and new.concluida_em is not distinct from old.concluida_em then return new; end if;
  v_usuario := coalesce(auth.uid(), new.usuario_id);
  select nome into v_nome from public.usuarios
   where id=v_usuario and empresa_id=new.empresa_id;
  if v_nome is null then v_usuario := new.usuario_id;
    select nome into v_nome from public.usuarios where id=v_usuario and empresa_id=new.empresa_id;
  end if;
  select nome into v_coluna from public.tarefa_colunas
    where id=new.coluna_id and usuario_id=new.usuario_id and empresa_id=new.empresa_id;
  insert into public.tarefa_movimentacoes
    (empresa_id,tarefa_grupo_id,tarefa_id,usuario_id,usuario_nome,coluna_nome,concluida)
  values
    (new.empresa_id,new.tarefa_grupo_id,new.id,v_usuario,coalesce(v_nome,'Usuário'),
     coalesce(v_coluna,'Etapa'),new.concluida_em is not null);
  return new;
end $$;
drop trigger if exists trg_registrar_movimentacao_tarefa_compartilhada on public.tarefas;
create trigger trg_registrar_movimentacao_tarefa_compartilhada
after update of coluna_id, concluida_em on public.tarefas
for each row execute function public.registrar_movimentacao_tarefa_compartilhada();
revoke execute on function public.registrar_movimentacao_tarefa_compartilhada() from public, anon, authenticated;


do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'tarefa_movimentacoes') then
    alter publication supabase_realtime add table public.tarefa_movimentacoes;
  end if;
end $$;
