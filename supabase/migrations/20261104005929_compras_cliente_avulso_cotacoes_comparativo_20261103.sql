-- Compras: ampliar destino sem obra e guardar cotações de fornecedor com PDF.
-- Migração aditiva e retrocompatível: não altera pedidos existentes.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';

alter table public.compras_solicitacoes
 drop constraint if exists compras_solicitacoes_destino_check;
alter table public.compras_solicitacoes
 add constraint compras_solicitacoes_destino_check
 check (destino in ('obra','estoque','cliente_avulso'));
alter table public.compras_solicitacoes
 drop constraint if exists compras_solicitacoes_check;
alter table public.compras_solicitacoes
 add constraint compras_solicitacoes_check
 check ((destino='estoque' and cliente_id is null and obra_id is null) or
        (destino='obra' and cliente_id is not null and obra_id is not null) or
        (destino='cliente_avulso' and cliente_id is not null and obra_id is null));

alter table public.compras_solicitacao_itens
 drop constraint if exists compras_solicitacao_itens_destino_valido_v1;
alter table public.compras_solicitacao_itens
 add constraint compras_solicitacao_itens_destino_valido_v1
 check ((destino='estoque' and cliente_id is null and obra_id is null) or
        (destino='obra' and cliente_id is not null and obra_id is not null) or
        (destino='cliente_avulso' and cliente_id is not null and obra_id is null));
create index if not exists compras_solicitacao_itens_cliente_avulso
 on public.compras_solicitacao_itens(empresa_id,cliente_id)
 where destino='cliente_avulso';

create or replace function private.compras_solicitacao_validar()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.destino='obra' and not exists(
  select 1 from public.obras o join public.clientes c on c.id=o.cliente_id
  where o.id=new.obra_id and c.id=new.cliente_id and
   o.empresa_id=new.empresa_id and c.empresa_id=new.empresa_id
 ) then raise exception 'Cliente e obra nao correspondem a empresa'; end if;
 if new.destino='cliente_avulso' and not exists(
  select 1 from public.clientes c
  where c.id=new.cliente_id and c.empresa_id=new.empresa_id
 ) then raise exception 'Cliente avulso nao pertence a empresa'; end if;
 if new.solicitante_id is not null and not exists(
  select 1 from public.usuarios where id=new.solicitante_id and empresa_id=new.empresa_id
 ) then raise exception 'Solicitante pertence a outra empresa';end if;
 if tg_op='UPDATE' and new.empresa_id<>old.empresa_id then
  raise exception 'Empresa da solicitacao imutavel';end if;
 return new;
end;$$;

create or replace function private.compras_solicitacao_item_validar()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_empresa uuid;v_padrao record;
begin
 select empresa_id,destino,cliente_id,obra_id into v_padrao
 from public.compras_solicitacoes where id=new.solicitacao_id;
 v_empresa:=v_padrao.empresa_id;
 if new.destino is null then
  new.destino:=v_padrao.destino;
  new.cliente_id:=v_padrao.cliente_id;
  new.obra_id:=v_padrao.obra_id;
 end if;
 if v_empresa is null or v_empresa<>new.empresa_id then
  raise exception 'Solicitacao de outra empresa';end if;
 if new.destino not in ('obra','estoque','cliente_avulso') then
  raise exception 'Destino do item obrigatorio';end if;
 if new.destino in ('obra','cliente_avulso') and new.quantidade_necessaria is null then
  raise exception 'Quantidade do cliente obrigatoria';end if;
 if new.destino='obra' then
  if not exists (select 1 from public.obras o join public.clientes c on c.id=o.cliente_id
   where o.id=new.obra_id and c.id=new.cliente_id
    and o.empresa_id=new.empresa_id and c.empresa_id=new.empresa_id)
   then raise exception 'Cliente e obra do item nao correspondem';end if;
 elsif new.destino='cliente_avulso' then
  if new.obra_id is not null or not exists(
   select 1 from public.clientes c
   where c.id=new.cliente_id and c.empresa_id=new.empresa_id)
  then raise exception 'Cliente avulso invalido';end if;
 elsif new.cliente_id is not null or new.obra_id is not null then
  raise exception 'Estoque nao pode indicar cliente ou obra';
 end if;
 if new.produto_id is not null and not exists
  (select 1 from public.produtos where id=new.produto_id and empresa_id=new.empresa_id)
  then raise exception 'Produto de outra empresa';end if;
 if tg_op='UPDATE' and (new.empresa_id<>old.empresa_id or
   new.solicitacao_id<>old.solicitacao_id)
  then raise exception 'Origem do item imutavel';end if;
 return new;
end;$$;

-- Preservar cotações do Compras 360 legado e permitir anexar seu PDF original.
alter table public.compras_cotacoes add column if not exists arquivo_path text;

-- Carrinho mantém convenção legada quantidade_obra como quantidade de destino cliente,
-- inclusive avulso; não movimenta estoque até conferência de NF.
create or replace function private.compras_carrinho_item_validar()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_item record;v_status text;v_uso numeric;
begin
 select i.solicitacao_id,i.quantidade_necessaria,i.status,i.destino into v_item
 from public.compras_solicitacao_itens i
 where i.id=new.item_id and i.empresa_id=new.empresa_id for update of i;
 if not found or v_item.status in ('cancelado','cancelamento_solicitado') then
  raise exception 'Item cancelado ou com cancelamento pendente';end if;
 select status into v_status from public.compras_carrinhos
 where id=new.carrinho_id and empresa_id=new.empresa_id;
 if v_status is null then raise exception 'Carrinho não encontrado';end if;
 if tg_op='UPDATE' and (new.empresa_id<>old.empresa_id or
  new.item_id<>old.item_id or new.carrinho_id<>old.carrinho_id) then
  raise exception 'Origem da compra imutavel';end if;
 if v_status<>'rascunho' then
  if tg_op<>'UPDATE' then raise exception 'Carrinho comprado: novas linhas proibidas';end if;
  if new.quantidade_obra is distinct from old.quantidade_obra or
   new.quantidade_estoque is distinct from old.quantidade_estoque or
   new.preco_unitario is distinct from old.preco_unitario or
   new.created_at is distinct from old.created_at then
   raise exception 'Carrinho comprado: preço e quantidade são imutáveis';end if;
  if new.recebido_obra < old.recebido_obra or
   new.recebido_estoque < old.recebido_estoque then
   raise exception 'Recebimento não pode ser reduzido sem estorno auditado';end if;
  return new;
 end if;
 if v_item.destino='estoque' and new.quantidade_obra<>0 then
  raise exception 'Quantidade obra proibida para estoque';end if;
 select coalesce(sum(ci.quantidade_obra),0) into v_uso
 from public.compras_carrinho_itens ci
 join public.compras_carrinhos ca on ca.id=ci.carrinho_id
 where ci.item_id=new.item_id and ci.id<>new.id and ca.status<>'cancelado';
 if v_item.destino in ('obra','cliente_avulso') and
  v_uso+new.quantidade_obra>v_item.quantidade_necessaria then
  raise exception 'Quantidade cliente maior que a necessidade';end if;
 return new;
end;$$;

create table if not exists public.compras_cotacoes_solicitacoes (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id),
 solicitacao_id uuid not null references public.compras_solicitacoes(id),
 fornecedor_id uuid not null references public.fornecedores(id),
 numero_proposta text,
 chave_envio uuid,
 data_proposta date,
 prazo_dias integer check (prazo_dias is null or prazo_dias between 0 and 3650),
 validade date,
 forma_pagamento text,
 frete numeric check(frete is null or frete>=0),
 desconto numeric not null default 0 check(desconto>=0),
 observacoes text,
 itens jsonb not null default '[]'::jsonb check(jsonb_typeof(itens)='array'),
 arquivo_path text,
 status text not null default 'em_analise' check(status in ('em_analise','aprovada','descartada')),
 selecionada boolean not null default false,
 criado_por_id uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists compras_cotacoes_solicitacoes_empresa
 on public.compras_cotacoes_solicitacoes(empresa_id,solicitacao_id,created_at desc);
create unique index if not exists compras_cotacoes_solicitacoes_idempotencia
 on public.compras_cotacoes_solicitacoes(empresa_id,chave_envio) where chave_envio is not null;
create unique index if not exists compras_cotacoes_solicitacoes_uma_selecionada
 on public.compras_cotacoes_solicitacoes(empresa_id,solicitacao_id) where selecionada;

alter table public.compras_cotacoes_solicitacoes enable row level security;
revoke all on public.compras_cotacoes_solicitacoes from public,anon,authenticated;
grant select,insert,update,delete on public.compras_cotacoes_solicitacoes to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('compras-cotacoes','compras-cotacoes',false,12582912,array['application/pdf'])
 on conflict(id) do nothing; -- NUNCA modificar configurações de um bucket já em uso.

-- Escolha atômica: evita dois fornecedores selecionados e rollback parcial.
create or replace function public.selecionar_cotacao_compras(
 p_empresa_id uuid,p_solicitacao_id uuid,p_cotacao_id uuid
) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform id from public.compras_cotacoes_solicitacoes
 where empresa_id=p_empresa_id and solicitacao_id=p_solicitacao_id for update;
 if not exists(select 1 from public.compras_cotacoes_solicitacoes
  where id=p_cotacao_id and empresa_id=p_empresa_id
   and solicitacao_id=p_solicitacao_id and status<>'descartada') then
  raise exception 'Cotacao indisponivel';
 end if;
 update public.compras_cotacoes_solicitacoes
 set selecionada=false,
     status=case when status='aprovada' then 'em_analise' else status end,
     updated_at=now()
 where empresa_id=p_empresa_id and solicitacao_id=p_solicitacao_id and selecionada;
 update public.compras_cotacoes_solicitacoes
 set selecionada=true,status='aprovada',updated_at=now()
 where empresa_id=p_empresa_id and solicitacao_id=p_solicitacao_id and id=p_cotacao_id;
end;$$;
revoke all on function public.selecionar_cotacao_compras(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.selecionar_cotacao_compras(uuid,uuid,uuid) to service_role;

commit;