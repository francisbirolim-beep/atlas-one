-- Compras: movimentos auditáveis e propostas recebidas de fornecedores.
-- A posição do card não liquida contas nem dá entrada automática no estoque.
create table if not exists public.venda_cotacao_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  lote_id uuid not null references public.venda_cotacao_lotes(id) on delete cascade,
  status_anterior text not null,
  status_novo text not null,
  versao_anterior integer not null,
  versao_nova integer not null,
  motivo text null,
  usuario_id uuid null,
  usuario_nome text null,
  created_at timestamptz not null default now()
);
create index if not exists venda_cotacao_movimentacoes_lote_idx
  on public.venda_cotacao_movimentacoes(empresa_id,lote_id,created_at desc);
alter table public.venda_cotacao_movimentacoes enable row level security;
revoke all on public.venda_cotacao_movimentacoes from public,anon,authenticated;

create table if not exists public.venda_cotacao_propostas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  lote_id uuid not null references public.venda_cotacao_lotes(id) on delete cascade,
  arquivo_nome text not null,
  arquivo_path text not null,
  fornecedor_nome text null,
  cnpj text null,
  prazo text null,
  moeda text not null default 'BRL',
  valor_total_documento numeric null,
  analise jsonb not null default '{}'::jsonb,
  itens_extraidos jsonb not null default '[]'::jsonb,
  ia_utilizada boolean not null default false,
  ia_erro text null,
  selecionada_em timestamptz null,
  selecionada_por_id uuid null,
  created_at timestamptz not null default now(),
  unique (empresa_id,arquivo_path)
);
create index if not exists venda_cotacao_propostas_lote_idx
  on public.venda_cotacao_propostas(empresa_id,lote_id,created_at desc);
alter table public.venda_cotacao_propostas enable row level security;
revoke all on public.venda_cotacao_propostas from public,anon,authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('compras-cotacoes','compras-cotacoes',false,15728640,array['application/pdf']::text[])
on conflict (id) do update set public=false, file_size_limit=15728640, allowed_mime_types=array['application/pdf']::text[];

-- Migração aditiva: mantém o histórico de todos os lotes existentes.
alter table public.venda_cotacao_lotes
  drop constraint if exists venda_cotacao_lotes_status_check;
alter table public.venda_cotacao_lotes
  add constraint venda_cotacao_lotes_status_check
  check (status in ('necessidade','cotacao','comprado','entrega','recebido','cancelado'));

create or replace function public.fn_mover_lote_cotacao_v1(
  p_empresa uuid, p_lote uuid, p_venda uuid, p_versao integer,
  p_destino text, p_usuario uuid, p_nome text, p_motivo text default null
)
returns table (id uuid,status text,versao integer)
language plpgsql security definer set search_path='public'
as $$
declare v record;
begin
  if p_destino not in ('necessidade','cotacao','comprado','entrega','recebido') then
    raise exception 'Etapa inválida';
  end if;
  select l.id,l.status,l.versao into v
  from public.venda_cotacao_lotes l
  where l.id=p_lote and l.empresa_id=p_empresa and l.venda_obra_id=p_venda
  for update;
  if not found then raise exception 'Cotação não encontrada nesta empresa'; end if;
  if v.versao<>p_versao then raise exception 'Card alterado por outro usuário; atualize e tente novamente'; end if;
  if v.status='cancelado' then raise exception 'Cotação cancelada'; end if;
  if v.status=p_destino then
    return query select v.id::uuid,v.status::text,v.versao::integer;
    return;
  end if;
  update public.venda_cotacao_lotes l set status=p_destino,versao=v.versao+1,updated_at=now()
    where l.id=p_lote and l.empresa_id=p_empresa;
  insert into public.venda_cotacao_movimentacoes
    (empresa_id,lote_id,status_anterior,status_novo,versao_anterior,versao_nova,motivo,usuario_id,usuario_nome)
  values (p_empresa,p_lote,v.status,p_destino,v.versao,v.versao+1,left(p_motivo,1000),p_usuario,left(p_nome,200));
  return query select v.id::uuid,p_destino::text,(v.versao+1)::integer;
end;
$$;
revoke all on function public.fn_mover_lote_cotacao_v1(uuid,uuid,uuid,integer,text,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.fn_mover_lote_cotacao_v1(uuid,uuid,uuid,integer,text,uuid,text,text) to service_role;

create table if not exists public.venda_cotacao_propostas_escolhas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  lote_id uuid not null references public.venda_cotacao_lotes(id) on delete cascade,
  proposta_id uuid not null references public.venda_cotacao_propostas(id),
  usuario_id uuid null,
  usuario_nome text null,
  created_at timestamptz not null default now()
);
alter table public.venda_cotacao_propostas_escolhas enable row level security;
revoke all on public.venda_cotacao_propostas_escolhas from public,anon,authenticated;

create or replace function public.fn_escolher_proposta_v1(
  p_empresa uuid,p_lote uuid,p_proposta uuid,p_usuario uuid,p_nome text
)
returns boolean language plpgsql security definer set search_path='public'
as $$
declare v_lote uuid;
begin
  select l.id into v_lote from public.venda_cotacao_lotes l
    where l.id=p_lote and l.empresa_id=p_empresa and l.status <> 'cancelado' for update;
  if v_lote is null then raise exception 'Cotação não encontrada'; end if;
  if not exists(select 1 from public.venda_cotacao_propostas p
    where p.id=p_proposta and p.lote_id=p_lote and p.empresa_id=p_empresa) then
    raise exception 'Proposta não encontrada';
  end if;
  update public.venda_cotacao_propostas set selecionada_em=null,selecionada_por_id=null
    where lote_id=p_lote and empresa_id=p_empresa;
  update public.venda_cotacao_propostas set selecionada_em=now(),selecionada_por_id=p_usuario
    where id=p_proposta and lote_id=p_lote and empresa_id=p_empresa;
  insert into public.venda_cotacao_propostas_escolhas
    (empresa_id,lote_id,proposta_id,usuario_id,usuario_nome)
    values(p_empresa,p_lote,p_proposta,p_usuario,left(p_nome,200));
  return true;
end;
$$;
revoke all on function public.fn_escolher_proposta_v1(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.fn_escolher_proposta_v1(uuid,uuid,uuid,uuid,text) to service_role;