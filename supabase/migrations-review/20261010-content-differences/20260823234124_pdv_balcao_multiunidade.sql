-- Atlas One — PDV Balcão integrado ao estoque multiunidade.
-- Produto é único. Caixa pertence a uma unidade e possui um local de estoque padrão.
-- Venda local consome estoque imediatamente; venda atendida por outra unidade reserva o saldo na origem.

create table if not exists public.balcao_pontos_caixa (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references public.unidades_operacionais(id) on delete restrict,
  local_estoque_id uuid not null references public.estoque_locais(id) on delete restrict,
  codigo text not null,
  nome text not null,
  tipo text not null default 'balcao' check (tipo in ('balcao','esquadrias','loja','outro')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(unidade_id,codigo)
);

insert into public.balcao_pontos_caixa(unidade_id,local_estoque_id,codigo,nome,tipo)
select u.id,l.id,'CX01','Caixa 01 — Balcão','balcao'
from public.unidades_operacionais u
join public.estoque_locais l on l.unidade_id=u.id and l.codigo='GERAL'
where u.codigo='MATRIZ'
  and not exists(select 1 from public.balcao_pontos_caixa pc where pc.unidade_id=u.id and pc.codigo='CX01');

insert into public.balcao_pontos_caixa(unidade_id,local_estoque_id,codigo,nome,tipo)
select u.id,l.id,'CX02','Caixa 02 — Esquadrias','esquadrias'
from public.unidades_operacionais u
join public.estoque_locais l on l.unidade_id=u.id and l.codigo='GERAL'
where u.codigo='MATRIZ'
  and not exists(select 1 from public.balcao_pontos_caixa pc where pc.unidade_id=u.id and pc.codigo='CX02');

alter table public.balcao_caixas
  add column if not exists ponto_caixa_id uuid references public.balcao_pontos_caixa(id) on delete restrict,
  add column if not exists unidade_id uuid references public.unidades_operacionais(id) on delete restrict,
  add column if not exists local_estoque_id uuid references public.estoque_locais(id) on delete restrict;

create unique index if not exists uq_balcao_ponto_caixa_aberto
  on public.balcao_caixas(ponto_caixa_id) where status='aberto' and ponto_caixa_id is not null;
create index if not exists idx_balcao_caixas_unidade on public.balcao_caixas(unidade_id,aberto_em desc);
create index if not exists idx_balcao_caixas_local on public.balcao_caixas(local_estoque_id,aberto_em desc);

alter table public.balcao_vendas
  add column if not exists unidade_id uuid references public.unidades_operacionais(id) on delete restrict,
  add column if not exists local_estoque_id uuid references public.estoque_locais(id) on delete restrict,
  add column if not exists atendimento_status text not null default 'entregue'
    check (atendimento_status in ('entregue','aguardando_separacao','parcial','cancelado')),
  add column if not exists previsao_entrega date;

alter table public.balcao_venda_itens
  add column if not exists local_origem_id uuid references public.estoque_locais(id) on delete restrict,
  add column if not exists atendimento_status text not null default 'entregue'
    check (atendimento_status in ('entregue','reservado_outra_unidade','cancelado'));

create index if not exists idx_balcao_vendas_unidade on public.balcao_vendas(unidade_id,finalizada_em desc);
create index if not exists idx_balcao_venda_itens_local_origem on public.balcao_venda_itens(local_origem_id,created_at desc);

alter table public.balcao_pontos_caixa enable row level security;
revoke all on public.balcao_pontos_caixa from anon, authenticated;
grant all on public.balcao_pontos_caixa to service_role;

-- Substitui a finalização antiga, que assumia um único saldo por produto.
-- A assinatura é preservada para manter compatibilidade com a API.
create or replace function public.finalizar_venda_balcao(
  p_caixa_id uuid,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_usuario_role text,
  p_cliente_id uuid,
  p_cliente_nome text,
  p_itens jsonb,
  p_pagamentos jsonb,
  p_desconto numeric default 0,
  p_observacoes text default null,
  p_permitir_abaixo_minimo boolean default false
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_caixa record;
  v_item jsonb;
  v_pag jsonb;
  v_prod record;
  v_local record;
  v_reserva jsonb;
  v_r record;
  v_s record;
  v_venda_id uuid;
  v_numero bigint;
  v_qtd numeric;
  v_preco numeric;
  v_subtotal numeric := 0;
  v_total numeric;
  v_pagamentos_total numeric := 0;
  v_custo numeric;
  v_custo_total numeric;
  v_qtd_custo numeric;
  v_margem numeric;
  v_forma text;
  v_valor numeric;
  v_parcelas integer;
  v_parcela_valor numeric;
  v_primeiro_vencimento date;
  v_intervalo_dias integer;
  v_local_origem_id uuid;
  v_atendimento_item text;
  v_atendimento_venda text := 'entregue';
  v_reservas_pendentes integer := 0;
  i integer;
begin
  select * into v_caixa from public.balcao_caixas where id=p_caixa_id for update;
  if v_caixa.id is null or v_caixa.status<>'aberto' then raise exception 'Caixa não está aberto.'; end if;
  if v_caixa.local_estoque_id is null or v_caixa.unidade_id is null or v_caixa.ponto_caixa_id is null then
    raise exception 'Caixa sem unidade/local configurado.';
  end if;
  if coalesce(p_usuario_role,'')<>'master' and v_caixa.operador_id<>p_usuario_id then
    raise exception 'Este caixa foi aberto por outro operador.';
  end if;
  if jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then raise exception 'Venda sem itens.'; end if;

  -- Validação comercial e de disponibilidade da origem escolhida.
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd:=nullif(v_item->>'quantidade','')::numeric;
    v_preco:=nullif(v_item->>'precoUnitario','')::numeric;
    v_local_origem_id:=coalesce(nullif(v_item->>'localOrigemId','')::uuid,v_caixa.local_estoque_id);
    if v_qtd is null or v_qtd<=0 then raise exception 'Quantidade inválida.'; end if;
    if v_preco is null or v_preco<0 then raise exception 'Preço inválido.'; end if;

    select id,codigo,nome,unidade,custo,preco,preco_minimo into v_prod
      from public.produtos where id=(v_item->>'produtoId')::uuid and ativo=true;
    if v_prod.id is null then raise exception 'Produto não encontrado ou inativo.'; end if;
    if v_prod.preco_minimo is not null and v_preco<v_prod.preco_minimo and not p_permitir_abaixo_minimo then
      raise exception 'Preço abaixo do mínimo permitido para %.',v_prod.nome;
    end if;

    select l.id,l.ativo,l.permite_venda,u.nome as unidade_nome,l.nome as local_nome into v_local
      from public.estoque_locais l join public.unidades_operacionais u on u.id=l.unidade_id
      where l.id=v_local_origem_id;
    if v_local.id is null or not v_local.ativo or not v_local.permite_venda then
      raise exception 'Local de estoque indisponível para venda.';
    end if;
    if (select coalesce(sum(greatest(0,quantidade-quantidade_reservada)),0)
        from public.estoque_saldos where produto_id=v_prod.id and local_id=v_local_origem_id) < v_qtd then
      raise exception 'Estoque disponível insuficiente para % em % / %.',v_prod.nome,v_local.unidade_nome,v_local.local_nome;
    end if;
    v_subtotal:=v_subtotal+(v_qtd*v_preco);
  end loop;

  if coalesce(p_desconto,0)<0 or coalesce(p_desconto,0)>v_subtotal then raise exception 'Desconto inválido.'; end if;
  v_total:=round(v_subtotal-coalesce(p_desconto,0),2);

  if jsonb_typeof(p_pagamentos)<>'array' or jsonb_array_length(p_pagamentos)=0 then raise exception 'Informe o pagamento.'; end if;
  for v_pag in select * from jsonb_array_elements(p_pagamentos) loop
    v_valor:=nullif(v_pag->>'valor','')::numeric;
    if v_valor is null or v_valor<=0 then raise exception 'Valor de pagamento inválido.'; end if;
    v_forma:=lower(trim(v_pag->>'forma'));
    if v_forma in ('boleto','a_prazo') and nullif(v_pag->>'primeiroVencimento','') is null then
      raise exception 'Informe o primeiro vencimento do pagamento a prazo.';
    end if;
    v_pagamentos_total:=v_pagamentos_total+v_valor;
  end loop;
  if abs(v_pagamentos_total-v_total)>0.01 then raise exception 'Pagamentos não fecham com o total da venda.'; end if;

  insert into public.balcao_vendas(
    cliente_id,cliente_nome,vendedor_id,vendedor_nome,caixa_id,unidade_id,local_estoque_id,
    subtotal,desconto,total,observacoes,atendimento_status
  ) values(
    p_cliente_id,nullif(trim(p_cliente_nome),''),p_usuario_id,p_usuario_nome,p_caixa_id,
    v_caixa.unidade_id,v_caixa.local_estoque_id,round(v_subtotal,2),coalesce(p_desconto,0),v_total,p_observacoes,'entregue'
  ) returning id,numero into v_venda_id,v_numero;

  -- Reserva primeiro. Assim duas lojas não conseguem prometer a mesma unidade.
  -- Se a origem for o estoque do próprio caixa, a reserva é consumida imediatamente.
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd:=(v_item->>'quantidade')::numeric;
    v_preco:=(v_item->>'precoUnitario')::numeric;
    v_local_origem_id:=coalesce(nullif(v_item->>'localOrigemId','')::uuid,v_caixa.local_estoque_id);
    select id,codigo,nome,unidade,custo,preco,preco_minimo into v_prod
      from public.produtos where id=(v_item->>'produtoId')::uuid;

    v_reserva:=public.reservar_estoque_local(
      v_prod.id,v_local_origem_id,v_qtd,'venda_balcao',v_venda_id,p_cliente_id,
      'Reserva da venda balcão #'||v_numero,null,p_usuario_id,p_usuario_nome
    );
    if coalesce((v_reserva->>'ok')::boolean,false)=false then
      raise exception 'Não foi possível reservar estoque para %. Disponível: %.',v_prod.nome,coalesce(v_reserva->>'disponivel','0');
    end if;

    v_custo_total:=0; v_qtd_custo:=0;
    for v_r in
      select * from public.estoque_reservas
      where origem_tipo='venda_balcao' and origem_id=v_venda_id and produto_id=v_prod.id
        and local_id=v_local_origem_id and status='ativa'
      order by created_at,id for update
    loop
      select * into v_s from public.estoque_saldos
      where produto_id=v_prod.id and local_id=v_local_origem_id
        and (endereco_id is not distinct from v_r.endereco_id) for update;
      if v_s.id is null or v_s.quantidade<v_r.quantidade or v_s.quantidade_reservada<v_r.quantidade then
        raise exception 'Saldo reservado inconsistente para %.',v_prod.nome;
      end if;
      v_custo_total:=v_custo_total+(v_r.quantidade*coalesce(v_s.custo_medio,v_prod.custo,0));
      v_qtd_custo:=v_qtd_custo+v_r.quantidade;

      if v_local_origem_id=v_caixa.local_estoque_id then
        update public.estoque_saldos
          set quantidade=quantidade-v_r.quantidade,
              quantidade_reservada=quantidade_reservada-v_r.quantidade,
              valor_estoque=greatest(0,valor_estoque-(v_r.quantidade*coalesce(custo_medio,0))),
              updated_at=now()
          where id=v_s.id;
        insert into public.estoque_movimentos(
          produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,origem_tipo,origem_id,
          observacoes,criado_por_id,criado_por_nome,local_origem_id,endereco_origem_id
        ) values(
          v_prod.id,'saida',v_r.quantidade,coalesce(v_s.unidade,v_prod.unidade),
          coalesce(v_s.custo_medio,v_prod.custo,0),v_r.quantidade*coalesce(v_s.custo_medio,v_prod.custo,0),
          'venda_balcao',v_venda_id,'Venda balcão #'||v_numero,p_usuario_id,p_usuario_nome,
          v_local_origem_id,v_r.endereco_id
        );
        update public.estoque_reservas set status='atendida',updated_at=now() where id=v_r.id;
      end if;
    end loop;

    v_custo:=case when v_qtd_custo>0 then v_custo_total/v_qtd_custo else coalesce(v_prod.custo,0) end;
    v_margem:=case when v_preco>0 then round(((v_preco-v_custo)/v_preco*100)::numeric,4) else null end;
    if v_local_origem_id=v_caixa.local_estoque_id then
      v_atendimento_item:='entregue';
    else
      v_atendimento_item:='reservado_outra_unidade';
      v_atendimento_venda:='aguardando_separacao';
      v_reservas_pendentes:=v_reservas_pendentes+1;
    end if;

    insert into public.balcao_venda_itens(
      venda_id,produto_id,produto_codigo,produto_nome,unidade,quantidade,custo_unitario_snapshot,
      preco_tabela_snapshot,preco_unitario,preco_minimo_snapshot,total_item,margem_real_percentual,
      local_origem_id,atendimento_status
    ) values(
      v_venda_id,v_prod.id,v_prod.codigo,v_prod.nome,v_prod.unidade,v_qtd,v_custo,
      v_prod.preco,v_preco,v_prod.preco_minimo,round(v_qtd*v_preco,2),v_margem,
      v_local_origem_id,v_atendimento_item
    );
    update public.produtos
      set ultimo_preco_vendido=v_preco,ultimo_preco_vendido_em=now(),updated_at=now()
      where id=v_prod.id;
  end loop;

  update public.balcao_vendas set atendimento_status=v_atendimento_venda where id=v_venda_id;

  for v_pag in select * from jsonb_array_elements(p_pagamentos) loop
    v_forma:=lower(trim(v_pag->>'forma'));
    v_valor:=(v_pag->>'valor')::numeric;
    v_parcelas:=greatest(1,coalesce(nullif(v_pag->>'parcelas','')::integer,1));
    if v_forma not in ('dinheiro','pix','cartao_debito','cartao_credito','boleto','a_prazo','outros') then
      raise exception 'Forma de pagamento inválida.';
    end if;
    insert into public.balcao_pagamentos(venda_id,forma,valor,parcelas,detalhes)
      values(v_venda_id,v_forma,v_valor,v_parcelas,nullif(v_pag->>'detalhes',''));

    if v_forma in ('dinheiro','pix','cartao_debito','cartao_credito','outros') then
      insert into public.balcao_caixa_movimentos(
        caixa_id,venda_id,tipo,forma_pagamento,entrada,descricao,criado_por_id,criado_por_nome
      ) values(
        p_caixa_id,v_venda_id,'recebimento',v_forma,v_valor,'Venda balcão #'||v_numero,p_usuario_id,p_usuario_nome
      );
    else
      v_primeiro_vencimento:=nullif(v_pag->>'primeiroVencimento','')::date;
      if v_primeiro_vencimento is null then raise exception 'Informe o primeiro vencimento do pagamento a prazo.'; end if;
      v_intervalo_dias:=greatest(1,coalesce(nullif(v_pag->>'intervaloDias','')::integer,30));
      v_parcela_valor:=round(v_valor/v_parcelas,2);
      for i in 1..v_parcelas loop
        insert into public.financeiro_contas_receber(
          venda_balcao_id,cliente_id,cliente_nome,documento,parcela,total_parcelas,vencimento,valor,
          forma,observacoes,criado_por_id,criado_por_nome
        ) values(
          v_venda_id,p_cliente_id,nullif(trim(p_cliente_nome),''),'VBC-'||v_numero,i,v_parcelas,
          v_primeiro_vencimento+((i-1)*v_intervalo_dias),
          case when i=v_parcelas then v_valor-(v_parcela_valor*(v_parcelas-1)) else v_parcela_valor end,
          v_forma,'Gerado pela venda balcão #'||v_numero,p_usuario_id,p_usuario_nome
        );
      end loop;
    end if;
  end loop;

  return jsonb_build_object(
    'ok',true,'vendaId',v_venda_id,'numero',v_numero,'subtotal',round(v_subtotal,2),'total',v_total,
    'atendimentoStatus',v_atendimento_venda,'reservasPendentes',v_reservas_pendentes
  );
end;
$$;

revoke all on function public.finalizar_venda_balcao(uuid,uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean)
  from public,anon,authenticated;
grant execute on function public.finalizar_venda_balcao(uuid,uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean)
  to service_role;
