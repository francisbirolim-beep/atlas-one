-- Produção física por unidade, sem reescrever ordens já concluídas.
-- NULL preserva comportamento legado das ordens que não iniciaram controle parcial.
alter table public.ordens_producao
  add column if not exists quantidade_produzida numeric null;
alter table public.ordens_producao
  drop constraint if exists ordens_producao_quantidade_produzida_check;
alter table public.ordens_producao
  add constraint ordens_producao_quantidade_produzida_check
  check (quantidade_produzida is null or
    (quantidade_produzida>=0 and quantidade_produzida<=quantidade
     and quantidade_produzida=trunc(quantidade_produzida)));

create table if not exists public.ordens_producao_unidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  ordem_id uuid not null references public.ordens_producao(id) on delete cascade,
  indice integer not null check (indice>0),
  status text not null default 'pendente' check (status in ('pendente','produzida')),
  produzido_em timestamptz null,
  produzido_por_id uuid null,
  produzido_por_nome text null,
  updated_at timestamptz not null default now(),
  unique(ordem_id,indice)
);
create index if not exists ordens_producao_unidades_empresa_ordem_idx
  on public.ordens_producao_unidades (empresa_id,ordem_id,status);
alter table public.ordens_producao_unidades enable row level security;
revoke all on public.ordens_producao_unidades from public,anon,authenticated;
grant select,insert,update on public.ordens_producao_unidades to service_role;

-- Impede que a conclusão legada de uma OP apague pendências já individualizadas.
create or replace function public.ordem_producao_unidades_guard_v1()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.status='concluida' and old.status is distinct from 'concluida'
    and new.quantidade_produzida is not null
    and new.quantidade_produzida<new.quantidade then
    raise exception 'Ordem com peças pendentes não pode ser concluída integralmente';
 end if;
 return new;
end; $$;
drop trigger if exists trg_ordem_producao_unidades_guard_v1 on public.ordens_producao;
create trigger trg_ordem_producao_unidades_guard_v1
 before update of status on public.ordens_producao
 for each row execute function public.ordem_producao_unidades_guard_v1();
revoke execute on function public.ordem_producao_unidades_guard_v1() from public,anon,authenticated;

create or replace function public.fn_marcar_producao_unidades_v1(
  p_empresa uuid,p_ordem uuid,p_indices integer[],p_usuario uuid,p_nome text
) returns table (ordem_id uuid,indice integer,status text,produzidas integer,quantidade integer,ordem_status text)
language plpgsql security definer set search_path=public as $$
declare
  v record;
  v_total integer;
  v_prontas integer;
  v_qtd integer;
begin
  select o.id,o.quantidade,o.status,o.bloqueada,o.tipo_producao,o.empresa_id
    into v from public.ordens_producao o where o.id=p_ordem and o.empresa_id=p_empresa for update;
  if not found then raise exception 'Ordem não localizada nesta empresa'; end if;
  if v.bloqueada then raise exception 'Ordem bloqueada: confira os gates técnicos'; end if;
  if v.status<>'conferencia' then
    raise exception 'A ordem precisa estar em Conferência para registrar peças prontas';
  end if;
  if v.quantidade<>trunc(v.quantidade) or v.quantidade<1 or v.quantidade>300 then
    raise exception 'Quantidade de unidades da OP inválida para conferência individual';
  end if;
  v_qtd:=v.quantidade::integer;
  v_total:=cardinality(p_indices);
  if p_indices is null or v_total<1 or v_total>v_qtd or
      (select count(distinct x) from unnest(p_indices) x)<>v_total or
      exists(select 1 from unnest(p_indices) x where x is null or x<1 or x>v_qtd) then
    raise exception 'Seleção de unidades inválida';
  end if;
  insert into public.ordens_producao_unidades(empresa_id,ordem_id,indice)
  select p_empresa,p_ordem,i from generate_series(1,v_qtd) i
  on conflict(ordem_id,indice) do nothing;
  update public.ordens_producao_unidades u
    set status='produzida',produzido_em=now(),produzido_por_id=p_usuario,
        produzido_por_nome=left(p_nome,200),updated_at=now()
  where u.empresa_id=p_empresa and u.ordem_id=p_ordem and u.indice=any(p_indices)
    and u.status='pendente';
  select count(*) into v_prontas from public.ordens_producao_unidades u
    where u.empresa_id=p_empresa and u.ordem_id=p_ordem and u.status='produzida';
  -- Só concluir o status geral quando todas as unidades estiverem realmente prontas.
  update public.ordens_producao o
    set quantidade_produzida=v_prontas,
        status=case when v_prontas=v_qtd then 'concluida' else 'conferencia' end
    where o.empresa_id=p_empresa and o.id=p_ordem;
  return query
    select u.ordem_id,u.indice,u.status,v_prontas,v_qtd,
      case when v_prontas=v_qtd then 'concluida' else 'conferencia' end
    from public.ordens_producao_unidades u
    where u.empresa_id=p_empresa and u.ordem_id=p_ordem order by u.indice;
end; $$;
revoke all on function public.fn_marcar_producao_unidades_v1(uuid,uuid,integer[],uuid,text)
  from public,anon,authenticated;
grant execute on function public.fn_marcar_producao_unidades_v1(uuid,uuid,integer[],uuid,text)
  to service_role;
