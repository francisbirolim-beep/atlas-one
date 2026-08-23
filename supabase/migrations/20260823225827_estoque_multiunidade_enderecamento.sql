-- Atlas One — Estoque multiunidade, endereçamento, reservas e transferências
-- Regra permanente: produto é único; saldo físico pertence a um local/endereço.

create table if not exists public.unidades_operacionais (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo text not null default 'unidade' check (tipo in ('matriz','fabrica','loja','deposito','unidade')),
  cidade text,
  endereco text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estoque_locais (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades_operacionais(id) on delete restrict,
  codigo text not null,
  nome text not null,
  tipo text not null default 'geral' check (tipo in ('geral','materia_prima','produto_acabado','loja','deposito','transito','avariado')),
  permite_venda boolean not null default true,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(unidade_id,codigo)
);

create table if not exists public.estoque_enderecos (
  id uuid primary key default gen_random_uuid(),
  local_id uuid not null references public.estoque_locais(id) on delete cascade,
  codigo text not null,
  zona text,
  corredor text,
  estante text,
  prateleira text,
  caixa text,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(local_id,codigo)
);

-- Uma única unidade/local padrão mantém a operação atual simples.
insert into public.unidades_operacionais(codigo,nome,tipo,cidade)
select 'MATRIZ','Matriz / Esquadrifácio','matriz','José Bonifácio'
where not exists(select 1 from public.unidades_operacionais where codigo='MATRIZ');

insert into public.estoque_locais(unidade_id,codigo,nome,tipo,permite_venda)
select u.id,'GERAL','Estoque Geral','geral',true
from public.unidades_operacionais u
where u.codigo='MATRIZ'
  and not exists(select 1 from public.estoque_locais l where l.unidade_id=u.id and l.codigo='GERAL');

-- Evolui o saldo antigo de 1 linha por produto para N linhas por produto/local/endereço.
alter table public.estoque_saldos add column if not exists id uuid default gen_random_uuid();
alter table public.estoque_saldos add column if not exists local_id uuid references public.estoque_locais(id) on delete restrict;
alter table public.estoque_saldos add column if not exists endereco_id uuid references public.estoque_enderecos(id) on delete restrict;
alter table public.estoque_saldos add column if not exists quantidade_reservada numeric not null default 0;

update public.estoque_saldos s
set local_id = l.id
from public.estoque_locais l
join public.unidades_operacionais u on u.id=l.unidade_id
where s.local_id is null and u.codigo='MATRIZ' and l.codigo='GERAL';

alter table public.estoque_saldos alter column local_id set not null;
alter table public.estoque_saldos drop constraint if exists estoque_saldos_pkey;
alter table public.estoque_saldos add constraint estoque_saldos_pkey primary key(id);
alter table public.estoque_saldos add constraint estoque_saldos_reserva_valida check (quantidade_reservada >= 0 and quantidade_reservada <= quantidade);
create unique index if not exists uq_estoque_saldo_produto_local_endereco
  on public.estoque_saldos(produto_id,local_id,coalesce(endereco_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists idx_estoque_saldos_local on public.estoque_saldos(local_id,produto_id);

alter table public.estoque_movimentos add column if not exists local_origem_id uuid references public.estoque_locais(id) on delete restrict;
alter table public.estoque_movimentos add column if not exists local_destino_id uuid references public.estoque_locais(id) on delete restrict;
alter table public.estoque_movimentos add column if not exists endereco_origem_id uuid references public.estoque_enderecos(id) on delete restrict;
alter table public.estoque_movimentos add column if not exists endereco_destino_id uuid references public.estoque_enderecos(id) on delete restrict;

create table if not exists public.estoque_reservas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete restrict,
  local_id uuid not null references public.estoque_locais(id) on delete restrict,
  endereco_id uuid references public.estoque_enderecos(id) on delete restrict,
  quantidade numeric not null check (quantidade > 0),
  status text not null default 'ativa' check (status in ('ativa','atendida','cancelada','expirada')),
  origem_tipo text not null,
  origem_id uuid,
  cliente_id uuid references public.clientes(id) on delete set null,
  observacoes text,
  reservado_ate timestamptz,
  criado_por_id uuid references auth.users(id),
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_estoque_reservas_ativas on public.estoque_reservas(produto_id,local_id,status);

create table if not exists public.estoque_transferencias (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated by default as identity unique,
  local_origem_id uuid not null references public.estoque_locais(id) on delete restrict,
  local_destino_id uuid not null references public.estoque_locais(id) on delete restrict,
  status text not null default 'solicitada' check (status in ('solicitada','separacao','em_transito','recebida','cancelada')),
  motivo text,
  previsao date,
  solicitado_por_id uuid references auth.users(id),
  solicitado_por_nome text,
  recebido_por_id uuid references auth.users(id),
  recebido_por_nome text,
  enviado_em timestamptz,
  recebido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transferencia_locais_diferentes check (local_origem_id <> local_destino_id)
);

create table if not exists public.estoque_transferencia_itens (
  id uuid primary key default gen_random_uuid(),
  transferencia_id uuid not null references public.estoque_transferencias(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  quantidade_solicitada numeric not null check (quantidade_solicitada > 0),
  quantidade_separada numeric not null default 0 check (quantidade_separada >= 0),
  quantidade_recebida numeric not null default 0 check (quantidade_recebida >= 0),
  endereco_origem_id uuid references public.estoque_enderecos(id) on delete set null,
  endereco_destino_id uuid references public.estoque_enderecos(id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_transferencias_status on public.estoque_transferencias(status,created_at desc);

-- Consulta de rede: físico, reservado e disponível por unidade/local/endereço.
create or replace view public.estoque_disponibilidade_rede as
select
  s.produto_id,
  s.local_id,
  l.unidade_id,
  u.codigo as unidade_codigo,
  u.nome as unidade_nome,
  l.codigo as local_codigo,
  l.nome as local_nome,
  s.endereco_id,
  e.codigo as endereco_codigo,
  e.zona,e.corredor,e.estante,e.prateleira,e.caixa,
  s.unidade,
  s.quantidade as quantidade_fisica,
  s.quantidade_reservada,
  greatest(0,s.quantidade-s.quantidade_reservada) as quantidade_disponivel,
  s.custo_medio,
  s.valor_estoque,
  s.updated_at
from public.estoque_saldos s
join public.estoque_locais l on l.id=s.local_id
join public.unidades_operacionais u on u.id=l.unidade_id
left join public.estoque_enderecos e on e.id=s.endereco_id;

-- Reserva atômica: impede prometer a mesma quantidade para dois clientes.
create or replace function public.reservar_estoque_local(
  p_produto_id uuid,
  p_local_id uuid,
  p_quantidade numeric,
  p_origem_tipo text,
  p_origem_id uuid,
  p_cliente_id uuid,
  p_observacoes text,
  p_reservado_ate timestamptz,
  p_usuario_id uuid,
  p_usuario_nome text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  s record;
  v_disponivel numeric;
  v_reserva_id uuid;
begin
  if p_quantidade is null or p_quantidade <= 0 then raise exception 'Quantidade inválida'; end if;
  select * into s from public.estoque_saldos
   where produto_id=p_produto_id and local_id=p_local_id
   order by quantidade-quantidade_reservada desc limit 1 for update;
  if s.id is null then return jsonb_build_object('ok',false,'motivo','sem_saldo_local'); end if;
  v_disponivel := greatest(0,s.quantidade-s.quantidade_reservada);
  if v_disponivel < p_quantidade then return jsonb_build_object('ok',false,'motivo','saldo_insuficiente','disponivel',v_disponivel); end if;
  insert into public.estoque_reservas(produto_id,local_id,endereco_id,quantidade,origem_tipo,origem_id,cliente_id,observacoes,reservado_ate,criado_por_id,criado_por_nome)
  values(p_produto_id,p_local_id,s.endereco_id,p_quantidade,p_origem_tipo,p_origem_id,p_cliente_id,p_observacoes,p_reservado_ate,p_usuario_id,p_usuario_nome)
  returning id into v_reserva_id;
  update public.estoque_saldos set quantidade_reservada=quantidade_reservada+p_quantidade,updated_at=now() where id=s.id;
  return jsonb_build_object('ok',true,'reserva_id',v_reserva_id,'disponivel_apos',v_disponivel-p_quantidade);
end;
$$;

create or replace function public.cancelar_reserva_estoque(
  p_reserva_id uuid,
  p_usuario_id uuid,
  p_usuario_nome text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare r record;
begin
  select * into r from public.estoque_reservas where id=p_reserva_id for update;
  if r.id is null then raise exception 'Reserva não encontrada'; end if;
  if r.status <> 'ativa' then return jsonb_build_object('ok',true,'ja_finalizada',true); end if;
  update public.estoque_reservas set status='cancelada',updated_at=now(),observacoes=concat_ws(E'\n',observacoes,'Cancelada por '||coalesce(p_usuario_nome,'usuário')) where id=p_reserva_id;
  update public.estoque_saldos set quantidade_reservada=greatest(0,quantidade_reservada-r.quantidade),updated_at=now()
   where produto_id=r.produto_id and local_id=r.local_id and (endereco_id is not distinct from r.endereco_id);
  return jsonb_build_object('ok',true);
end;
$$;

-- Recebimento de NF continua entrando no local padrão até o usuário escolher outro local.
create or replace function public.aplicar_estoque_recebimento(
  p_recebimento_item_id uuid,
  p_usuario_id uuid,
  p_usuario_nome text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record; v_fator numeric; v_qtd_util numeric; v_custo_compra numeric; v_custo_estoque numeric;
  v_local_id uuid; v_saldo record; v_nova_qtd numeric; v_novo_valor numeric; v_novo_custo numeric;
begin
  if exists(select 1 from public.estoque_movimentos where recebimento_item_id=p_recebimento_item_id and origem_tipo='recebimento_nf') then
    return jsonb_build_object('ok',true,'duplicado',true);
  end if;
  select ri.*,ci.nf_id,ci.custo_aquisicao_unitario,ci.unidade,ci.fator_conversao,ci.unidade_estoque,cr.id as recebimento_id,cn.fornecedor_id
    into r from public.compras_recebimento_itens ri
    join public.compras_nf_itens ci on ci.id=ri.nf_item_id
    join public.compras_recebimentos cr on cr.id=ri.recebimento_id
    join public.compras_nfs cn on cn.id=ci.nf_id where ri.id=p_recebimento_item_id;
  if r.id is null then raise exception 'Item de recebimento não encontrado'; end if;
  if r.produto_id is null then return jsonb_build_object('ok',false,'motivo','produto_pendente'); end if;
  v_fator := coalesce(r.fator_conversao,(select pf.fator_conversao from public.produto_fornecedores pf where pf.produto_id=r.produto_id and pf.fornecedor_id=r.fornecedor_id and pf.ativo=true order by pf.preferencial desc,pf.updated_at desc limit 1));
  if v_fator is null or v_fator<=0 then return jsonb_build_object('ok',false,'motivo','conversao_pendente'); end if;
  v_qtd_util := greatest(0,coalesce(r.quantidade_recebida,0)-coalesce(r.quantidade_avariada,0))*v_fator;
  if v_qtd_util<=0 then return jsonb_build_object('ok',true,'quantidade',0); end if;
  v_custo_compra:=coalesce(r.custo_aquisicao_unitario,0); v_custo_estoque:=case when v_fator>0 then v_custo_compra/v_fator else null end;
  select l.id into v_local_id from public.estoque_locais l join public.unidades_operacionais u on u.id=l.unidade_id where u.codigo='MATRIZ' and l.codigo='GERAL' limit 1;
  if v_local_id is null then raise exception 'Local padrão de estoque não encontrado'; end if;
  select * into v_saldo from public.estoque_saldos where produto_id=r.produto_id and local_id=v_local_id and endereco_id is null for update;
  if v_saldo.id is null then
    v_nova_qtd:=v_qtd_util; v_novo_valor:=v_qtd_util*coalesce(v_custo_estoque,0); v_novo_custo:=case when v_nova_qtd>0 then v_novo_valor/v_nova_qtd else null end;
    insert into public.estoque_saldos(produto_id,local_id,unidade,quantidade,quantidade_reservada,custo_medio,valor_estoque)
    values(r.produto_id,v_local_id,coalesce(r.unidade_estoque,(select unidade from public.produtos where id=r.produto_id)),v_nova_qtd,0,v_novo_custo,v_novo_valor);
  else
    v_nova_qtd:=v_saldo.quantidade+v_qtd_util; v_novo_valor:=v_saldo.valor_estoque+v_qtd_util*coalesce(v_custo_estoque,0); v_novo_custo:=case when v_nova_qtd>0 then v_novo_valor/v_nova_qtd else v_saldo.custo_medio end;
    update public.estoque_saldos set quantidade=v_nova_qtd,valor_estoque=v_novo_valor,custo_medio=v_novo_custo,unidade=coalesce(unidade,r.unidade_estoque),updated_at=now() where id=v_saldo.id;
  end if;
  insert into public.estoque_movimentos(produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,quantidade_avariada_origem,origem_tipo,origem_id,nf_id,nf_item_id,recebimento_id,recebimento_item_id,local_destino_id,criado_por_id,criado_por_nome)
  values(r.produto_id,'entrada',v_qtd_util,coalesce(r.unidade_estoque,(select unidade from public.produtos where id=r.produto_id)),v_custo_estoque,v_qtd_util*coalesce(v_custo_estoque,0),coalesce(r.quantidade_avariada,0),'recebimento_nf',r.recebimento_id,r.nf_id,r.nf_item_id,r.recebimento_id,p_recebimento_item_id,v_local_id,p_usuario_id,p_usuario_nome);
  update public.produtos set custo=v_novo_custo,updated_at=now() where id=r.produto_id and v_novo_custo is not null;
  return jsonb_build_object('ok',true,'quantidade',v_qtd_util,'custo_medio',v_novo_custo,'local_id',v_local_id);
end;
$$;

alter table public.unidades_operacionais enable row level security;
alter table public.estoque_locais enable row level security;
alter table public.estoque_enderecos enable row level security;
alter table public.estoque_reservas enable row level security;
alter table public.estoque_transferencias enable row level security;
alter table public.estoque_transferencia_itens enable row level security;

revoke all on public.unidades_operacionais,public.estoque_locais,public.estoque_enderecos,public.estoque_reservas,public.estoque_transferencias,public.estoque_transferencia_itens from anon,authenticated;
grant all on public.unidades_operacionais,public.estoque_locais,public.estoque_enderecos,public.estoque_reservas,public.estoque_transferencias,public.estoque_transferencia_itens to service_role;
revoke all on function public.reservar_estoque_local(uuid,uuid,numeric,text,uuid,uuid,text,timestamptz,uuid,text) from public,anon,authenticated;
revoke all on function public.cancelar_reserva_estoque(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.aplicar_estoque_recebimento(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reservar_estoque_local(uuid,uuid,numeric,text,uuid,uuid,text,timestamptz,uuid,text) to service_role;
grant execute on function public.cancelar_reserva_estoque(uuid,uuid,text) to service_role;
grant execute on function public.aplicar_estoque_recebimento(uuid,uuid,text) to service_role;
