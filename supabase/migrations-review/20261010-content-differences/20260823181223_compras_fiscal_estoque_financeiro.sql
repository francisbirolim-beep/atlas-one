-- Atlas One — Compras: fiscal completo, vínculo fornecedor, estoque e contas a pagar
-- Fluxo: NF confirmada gera fiscal/financeiro; estoque só entra no recebimento físico confirmado.

alter table public.compras_nfs
  add column if not exists base_icms numeric,
  add column if not exists valor_icms numeric,
  add column if not exists base_icms_st numeric,
  add column if not exists valor_icms_st numeric,
  add column if not exists valor_ipi numeric,
  add column if not exists valor_pis numeric,
  add column if not exists valor_cofins numeric,
  add column if not exists valor_frete numeric,
  add column if not exists valor_seguro numeric,
  add column if not exists valor_desconto numeric,
  add column if not exists outras_despesas numeric,
  add column if not exists pagamentos jsonb not null default '[]'::jsonb,
  add column if not exists financeiro_gerado boolean not null default false;

alter table public.compras_nf_itens
  add column if not exists cst text,
  add column if not exists csosn text,
  add column if not exists base_icms numeric,
  add column if not exists valor_icms numeric,
  add column if not exists aliquota_icms numeric,
  add column if not exists base_icms_st numeric,
  add column if not exists valor_icms_st numeric,
  add column if not exists aliquota_icms_st numeric,
  add column if not exists valor_ipi numeric,
  add column if not exists aliquota_ipi numeric,
  add column if not exists valor_pis numeric,
  add column if not exists aliquota_pis numeric,
  add column if not exists valor_cofins numeric,
  add column if not exists aliquota_cofins numeric,
  add column if not exists custo_aquisicao_unitario numeric,
  add column if not exists unidade_estoque text,
  add column if not exists fator_conversao numeric;

create table if not exists public.produto_fornecedores (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id) on delete cascade,
  codigo_fornecedor text not null,
  descricao_fornecedor text,
  ncm_fornecedor text,
  unidade_compra text,
  fator_conversao numeric,
  preferencial boolean not null default false,
  ativo boolean not null default true,
  criado_por_id uuid references auth.users(id),
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint produto_fornecedores_fator_positivo check (fator_conversao is null or fator_conversao > 0)
);
create unique index if not exists uq_produto_fornecedor_codigo
  on public.produto_fornecedores (fornecedor_id, upper(codigo_fornecedor));
create index if not exists idx_produto_fornecedores_produto on public.produto_fornecedores(produto_id);

create table if not exists public.estoque_saldos (
  produto_id uuid primary key references public.produtos(id) on delete cascade,
  unidade text,
  quantidade numeric not null default 0,
  custo_medio numeric,
  valor_estoque numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id),
  tipo text not null check (tipo in ('entrada','saida','ajuste')),
  quantidade numeric not null,
  unidade text,
  custo_unitario numeric,
  valor_total numeric,
  quantidade_avariada_origem numeric not null default 0,
  origem_tipo text not null,
  origem_id uuid,
  nf_id uuid references public.compras_nfs(id),
  nf_item_id uuid references public.compras_nf_itens(id),
  recebimento_id uuid references public.compras_recebimentos(id),
  recebimento_item_id uuid references public.compras_recebimento_itens(id),
  observacoes text,
  criado_por_id uuid references auth.users(id),
  criado_por_nome text,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_estoque_movimento_recebimento_item
  on public.estoque_movimentos(recebimento_item_id)
  where recebimento_item_id is not null and origem_tipo = 'recebimento_nf';
create index if not exists idx_estoque_movimentos_produto on public.estoque_movimentos(produto_id, created_at desc);

create table if not exists public.financeiro_contas_pagar (
  id uuid primary key default gen_random_uuid(),
  nf_id uuid references public.compras_nfs(id) on delete set null,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  fornecedor_nome text,
  documento text,
  parcela text not null default '1',
  descricao text,
  data_emissao date,
  vencimento date,
  valor numeric not null check (valor >= 0),
  status text not null default 'aberto' check (status in ('aberto','pendente_vencimento','pago','cancelado')),
  data_pagamento date,
  valor_pago numeric,
  forma_pagamento text,
  observacoes text,
  origem text not null default 'nf_compra',
  criado_por_id uuid references auth.users(id),
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uq_contas_pagar_nf_parcela
  on public.financeiro_contas_pagar(nf_id, parcela)
  where nf_id is not null;
create index if not exists idx_contas_pagar_vencimento on public.financeiro_contas_pagar(status, vencimento);

alter table public.produto_fornecedores enable row level security;
alter table public.estoque_saldos enable row level security;
alter table public.estoque_movimentos enable row level security;
alter table public.financeiro_contas_pagar enable row level security;

revoke all on public.produto_fornecedores from anon, authenticated;
revoke all on public.estoque_saldos from anon, authenticated;
revoke all on public.estoque_movimentos from anon, authenticated;
revoke all on public.financeiro_contas_pagar from anon, authenticated;
grant all on public.produto_fornecedores to service_role;
grant all on public.estoque_saldos to service_role;
grant all on public.estoque_movimentos to service_role;
grant all on public.financeiro_contas_pagar to service_role;

-- Movimento atômico de estoque por item de recebimento. A quantidade avariada não entra em saldo disponível.
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
  r record;
  v_fator numeric;
  v_qtd_util numeric;
  v_custo_compra numeric;
  v_custo_estoque numeric;
  v_saldo record;
  v_nova_qtd numeric;
  v_novo_valor numeric;
  v_novo_custo numeric;
begin
  if exists(select 1 from public.estoque_movimentos where recebimento_item_id = p_recebimento_item_id and origem_tipo='recebimento_nf') then
    return jsonb_build_object('ok', true, 'duplicado', true);
  end if;

  select ri.*, ci.nf_id, ci.custo_aquisicao_unitario, ci.unidade, ci.fator_conversao, ci.unidade_estoque,
         cr.id as recebimento_id, cn.fornecedor_id
    into r
    from public.compras_recebimento_itens ri
    join public.compras_nf_itens ci on ci.id = ri.nf_item_id
    join public.compras_recebimentos cr on cr.id = ri.recebimento_id
    join public.compras_nfs cn on cn.id = ci.nf_id
   where ri.id = p_recebimento_item_id;

  if r.id is null then raise exception 'Item de recebimento não encontrado'; end if;
  if r.produto_id is null then return jsonb_build_object('ok', false, 'motivo', 'produto_pendente'); end if;

  v_fator := coalesce(r.fator_conversao,
    (select pf.fator_conversao from public.produto_fornecedores pf
      where pf.produto_id=r.produto_id and pf.fornecedor_id=r.fornecedor_id and pf.ativo=true
      order by pf.preferencial desc, pf.updated_at desc limit 1));

  if v_fator is null or v_fator <= 0 then
    return jsonb_build_object('ok', false, 'motivo', 'conversao_pendente');
  end if;

  v_qtd_util := greatest(0, coalesce(r.quantidade_recebida,0) - coalesce(r.quantidade_avariada,0)) * v_fator;
  if v_qtd_util <= 0 then return jsonb_build_object('ok', true, 'quantidade', 0); end if;

  v_custo_compra := coalesce(r.custo_aquisicao_unitario, 0);
  v_custo_estoque := case when v_fator > 0 then v_custo_compra / v_fator else null end;

  select * into v_saldo from public.estoque_saldos where produto_id=r.produto_id for update;
  if v_saldo.produto_id is null then
    v_nova_qtd := v_qtd_util;
    v_novo_valor := v_qtd_util * coalesce(v_custo_estoque,0);
    v_novo_custo := case when v_nova_qtd > 0 then v_novo_valor / v_nova_qtd else null end;
    insert into public.estoque_saldos(produto_id, unidade, quantidade, custo_medio, valor_estoque)
    values(r.produto_id, coalesce(r.unidade_estoque,(select unidade from public.produtos where id=r.produto_id)), v_nova_qtd, v_novo_custo, v_novo_valor);
  else
    v_nova_qtd := v_saldo.quantidade + v_qtd_util;
    v_novo_valor := v_saldo.valor_estoque + v_qtd_util * coalesce(v_custo_estoque,0);
    v_novo_custo := case when v_nova_qtd > 0 then v_novo_valor / v_nova_qtd else v_saldo.custo_medio end;
    update public.estoque_saldos set quantidade=v_nova_qtd, valor_estoque=v_novo_valor,
      custo_medio=v_novo_custo, unidade=coalesce(unidade,r.unidade_estoque), updated_at=now()
    where produto_id=r.produto_id;
  end if;

  insert into public.estoque_movimentos(
    produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,quantidade_avariada_origem,
    origem_tipo,origem_id,nf_id,nf_item_id,recebimento_id,recebimento_item_id,criado_por_id,criado_por_nome
  ) values(
    r.produto_id,'entrada',v_qtd_util,coalesce(r.unidade_estoque,(select unidade from public.produtos where id=r.produto_id)),
    v_custo_estoque,v_qtd_util*coalesce(v_custo_estoque,0),coalesce(r.quantidade_avariada,0),
    'recebimento_nf',r.recebimento_id,r.nf_id,r.nf_item_id,r.recebimento_id,p_recebimento_item_id,p_usuario_id,p_usuario_nome
  );

  update public.produtos set custo=v_novo_custo, updated_at=now() where id=r.produto_id and v_novo_custo is not null;
  return jsonb_build_object('ok', true, 'quantidade', v_qtd_util, 'custo_medio', v_novo_custo);
end;
$$;
revoke all on function public.aplicar_estoque_recebimento(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.aplicar_estoque_recebimento(uuid,uuid,text) to service_role;
