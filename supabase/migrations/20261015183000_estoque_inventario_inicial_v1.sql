-- Inventario inicial isolado: nao altera saldos ate aprovacao explicitamente autenticada.
-- Nao executar diretamente em producao sem homologacao e snapshot.
create table if not exists public.estoque_inventarios (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 local_id uuid not null references public.estoque_locais(id),
 status text not null default 'rascunho' check (status in ('rascunho','aplicado','cancelado')),
 observacoes text,
 criado_por_id uuid not null references public.usuarios(id),
 criado_por_nome text not null,
 aprovado_por_id uuid references public.usuarios(id),
 aprovado_por_nome text,
 aprovado_em timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists idx_estoque_inventarios_empresa_data on public.estoque_inventarios(empresa_id,created_at desc);

create table if not exists public.estoque_inventario_itens (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 inventario_id uuid not null references public.estoque_inventarios(id) on delete restrict,
 produto_id uuid not null references public.produtos(id),
 quantidade_contada numeric not null check (quantidade_contada >= 0),
 saldo_referencia_id uuid references public.estoque_saldos(id),
 saldo_referencia numeric,
 saldo_referencia_atualizado_em timestamptz,
 custo_inicial_referencia numeric check (custo_inicial_referencia >= 0),
 quantidade_aplicada_delta numeric,
 created_at timestamptz not null default now(),
 unique(inventario_id,produto_id)
);
create index if not exists idx_estoque_inventario_itens_empresa on public.estoque_inventario_itens(empresa_id,inventario_id);
alter table public.estoque_inventarios enable row level security;
alter table public.estoque_inventario_itens enable row level security;
-- Sem policies diretas: somente rotas no servidor com usuario autenticado e service_role.

create or replace function public.aprovar_inventario_estoque(
 p_inventario_id uuid,
 p_usuario_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_empresa uuid;
 v_nome text;
 v_role text;
 v_inv public.estoque_inventarios%rowtype;
 v_item record;
 v_saldo public.estoque_saldos%rowtype;
 v_saldo_existe boolean;
 v_atual numeric;
 v_reservado numeric;
 v_delta numeric;
 v_custo numeric;
 v_mudancas int := 0;
 v_itens int := 0;
begin
 select u.empresa_id,u.nome,u.role into v_empresa,v_nome,v_role
 from public.usuarios u where u.id = p_usuario_id;

 if v_empresa is null or lower(coalesce(v_role,'')) <> 'master' then
  raise exception 'Aprovacao de inventario restrita ao Master.';
 end if;
 -- A funcao e acessivel somente a service_role. A rota verifica o JWT.
 select * into v_inv from public.estoque_inventarios
 where id=p_inventario_id and empresa_id=v_empresa for update;
 if v_inv.id is null then raise exception 'Inventario nao encontrado nesta empresa.'; end if;
 if v_inv.status <> 'rascunho' then raise exception 'Inventario ja processado ou cancelado.'; end if;
 if not exists(select 1 from public.estoque_locais where id=v_inv.local_id and empresa_id=v_empresa)
 then raise exception 'Local de inventario invalido.'; end if;

 for v_item in
  select i.*,p.unidade,p.empresa_id as produto_empresa,p.nome as produto_nome
  from public.estoque_inventario_itens i
  join public.produtos p on p.id=i.produto_id
  where i.inventario_id=v_inv.id and i.empresa_id=v_empresa
  order by i.produto_id
 loop
  v_itens := v_itens+1;
  if v_item.produto_empresa is distinct from v_empresa then
   raise exception 'Produto de outra empresa no inventario.';
  end if;

  -- Impede duas contagens aprovadas simultaneamente para o mesmo produto/local.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
   v_empresa::text||'/'||v_item.produto_id::text||'/'||v_inv.local_id::text||'/sem_endereco',0));

  -- Primeiro inventario atua apenas em estoque sem enderecamento.
  -- Se ha saldo em prateleira/caixa, exigir contagem especifica em outro fluxo.
  if exists(select 1 from public.estoque_saldos sx
    where sx.empresa_id=v_empresa and sx.produto_id=v_item.produto_id
      and sx.local_id=v_inv.local_id and sx.endereco_id is not null) then
    raise exception 'Produto % possui estoque enderecado; conferir por endereco antes de ajustar.',v_item.produto_nome;
  end if;

  select * into v_saldo from public.estoque_saldos s
  where s.empresa_id=v_empresa and s.produto_id=v_item.produto_id
    and s.local_id=v_inv.local_id and s.endereco_id is null
  for update;
  v_saldo_existe := found;
  if v_item.saldo_referencia_id is null and v_saldo_existe then
   raise exception 'Estoque do produto % mudou desde a contagem. Reconferir.',v_item.produto_nome;
  elsif v_item.saldo_referencia_id is not null and
        (not v_saldo_existe or v_saldo.id <> v_item.saldo_referencia_id
        or v_saldo.updated_at is distinct from v_item.saldo_referencia_atualizado_em
        or v_saldo.quantidade is distinct from v_item.saldo_referencia) then
   raise exception 'Saldo do produto % mudou. Criar nova contagem.',v_item.produto_nome;
  end if;

  v_atual := case when v_saldo_existe then v_saldo.quantidade else 0 end;
  v_reservado := case when v_saldo_existe then v_saldo.quantidade_reservada else 0 end;
  if v_item.quantidade_contada < v_reservado then
   raise exception 'Contagem do produto % menor do que sua reserva.',v_item.produto_nome;
  end if;
  v_delta := v_item.quantidade_contada-v_atual;
  v_custo := case when v_saldo_existe then v_saldo.custo_medio else null end;
  if v_custo is null then v_custo := v_item.custo_inicial_referencia; end if;
  if v_item.quantidade_contada > 0 and (v_custo is null or v_custo <= 0) then
   raise exception 'Custo inicial nao informado para %; corrigir cadastro antes de aprovar.',v_item.produto_nome;
  end if;

  if not v_saldo_existe then
   insert into public.estoque_saldos
    (empresa_id,produto_id,local_id,endereco_id,unidade,quantidade,quantidade_reservada,custo_medio,valor_estoque)
   values (v_empresa,v_item.produto_id,v_inv.local_id,null,v_item.unidade,v_item.quantidade_contada,0,
     v_custo, v_item.quantidade_contada*coalesce(v_custo,0));
  elsif v_delta <> 0 then
   update public.estoque_saldos set quantidade=v_item.quantidade_contada,
    valor_estoque=v_item.quantidade_contada*coalesce(v_custo,0),
    custo_medio=v_custo,updated_at=now()
   where id=v_saldo.id and empresa_id=v_empresa;
  end if;

  if v_delta <> 0 then
   insert into public.estoque_movimentos
    (empresa_id,produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,
     origem_tipo,origem_id,local_origem_id,local_destino_id,criado_por_id,criado_por_nome,observacoes)
   values
    (v_empresa,v_item.produto_id,'ajuste',v_delta,v_item.unidade,v_custo,
     v_delta*coalesce(v_custo,0),'inventario_inicial',v_inv.id,
     case when v_delta < 0 then v_inv.local_id else null end,
     case when v_delta > 0 then v_inv.local_id else null end,
     p_usuario_id,v_nome,'Inventario: '||v_atual||' -> '||v_item.quantidade_contada
       ||'; referencia '||v_inv.id||'; '||coalesce(v_inv.observacoes,''));
   v_mudancas := v_mudancas+1;
  end if;

  update public.estoque_inventario_itens set quantidade_aplicada_delta=v_delta
  where id=v_item.id and empresa_id=v_empresa;
 end loop;
 if v_itens=0 then raise exception 'Inventario sem itens.'; end if;

 update public.estoque_inventarios set status='aplicado',
   aprovado_por_id=p_usuario_id,aprovado_por_nome=v_nome,aprovado_em=now(),updated_at=now()
 where id=v_inv.id and empresa_id=v_empresa;

 return jsonb_build_object('ok',true,'inventarioId',v_inv.id,'itens',v_itens,'ajustes',v_mudancas);
end;
$$;
revoke all on function public.aprovar_inventario_estoque(uuid,uuid) from public,anon,authenticated;
grant execute on function public.aprovar_inventario_estoque(uuid,uuid) to service_role;

-- Grants explícitos para as APIs server-side, sem conceder acesso direto ao navegador.
revoke all on public.estoque_inventarios from anon, authenticated;
revoke all on public.estoque_inventario_itens from anon, authenticated;
grant select,insert,update,delete on public.estoque_inventarios to service_role;
grant select,insert,update,delete on public.estoque_inventario_itens to service_role;
