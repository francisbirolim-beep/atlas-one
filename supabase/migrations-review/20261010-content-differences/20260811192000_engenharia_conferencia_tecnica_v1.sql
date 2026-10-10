-- Engenharia Fase 3: conferencia tecnica persistente por peca e bloqueio de liberacao.

create table if not exists public.engenharia_conferencias (
  id uuid primary key default gen_random_uuid(),
  medicao_item_id uuid not null references public.medicao_itens(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'conferida', 'pendencia')),
  observacao text,
  responsavel_id uuid,
  responsavel_nome text,
  conferido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (medicao_item_id)
);

create index if not exists engenharia_conferencias_status_idx
  on public.engenharia_conferencias(status);

create or replace function public.fn_engenharia_conferencia_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'conferida' and old.status is distinct from 'conferida' then
    new.conferido_em := now();
  elsif new.status <> 'conferida' then
    new.conferido_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_engenharia_conferencia_touch on public.engenharia_conferencias;
create trigger trg_engenharia_conferencia_touch
before update on public.engenharia_conferencias
for each row execute function public.fn_engenharia_conferencia_touch();

create or replace function public.fn_bloquear_liberacao_engenharia_incompleta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_destino_nome text;
  v_medicao_id uuid;
  v_total_itens integer;
  v_total_conferidos integer;
begin
  if new.coluna_id is not distinct from old.coluna_id then
    return new;
  end if;

  select nome into v_destino_nome
    from public.setor_kanban_colunas
   where id = new.coluna_id;

  if coalesce(lower(v_destino_nome), '') not like '%liberad%produ%' then
    return new;
  end if;

  if new.orcamento_id is null then
    raise exception 'Nao foi possivel identificar o orcamento da obra para liberar a Producao';
  end if;

  select mf.id into v_medicao_id
    from public.medicoes_finais mf
   where mf.orcamento_id = new.orcamento_id
     and mf.status_operacional = 'aprovado'
   order by mf.aprovado_em desc nulls last
   limit 1;

  if v_medicao_id is null then
    raise exception 'Medição Final aprovada nao encontrada para esta obra';
  end if;

  select count(*) into v_total_itens
    from public.medicao_itens mi
   where mi.medicao_id = v_medicao_id;

  select count(*) into v_total_conferidos
    from public.medicao_itens mi
    join public.engenharia_conferencias ec on ec.medicao_item_id = mi.id
   where mi.medicao_id = v_medicao_id
     and ec.status = 'conferida';

  if v_total_itens = 0 or v_total_conferidos <> v_total_itens then
    raise exception 'Liberacao bloqueada: todas as pecas precisam estar conferidas pela Engenharia';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bloquear_liberacao_engenharia_incompleta on public.setor_kanban_itens;
create trigger trg_bloquear_liberacao_engenharia_incompleta
before update of coluna_id on public.setor_kanban_itens
for each row execute function public.fn_bloquear_liberacao_engenharia_incompleta();
