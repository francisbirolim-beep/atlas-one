-- Estorno administrativo seguro de recebimento incorreto.
-- Preserva recibo cancelado e auditoria. Nunca apaga histórico fiscal.
-- Recibos distribuídos entre vendas ou com Caixa fechado exigem conferência manual.
create table if not exists public.financeiro_recebimentos_cancelamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  recebimento_id uuid not null unique references public.financeiro_recebimentos(id),
  venda_obra_id uuid not null references public.vendas_obras(id),
  cliente_id uuid not null references public.clientes(id),
  valor_original numeric(15,2) not null,
  justificativa text not null check (char_length(trim(justificativa)) between 10 and 1000),
  autorizado_por uuid not null references auth.users(id),
  autorizado_por_nome text not null,
  status_anterior text not null,
  recibo_original jsonb not null,
  alocacoes_originais jsonb not null,
  caixa_movimentos_originais jsonb not null default '[]'::jsonb,
  cancelado_em timestamptz not null default now()
);
create index if not exists financeiro_cancel_receb_venda_idx on public.financeiro_recebimentos_cancelamentos
 (empresa_id,venda_obra_id,cancelado_em desc);
alter table public.financeiro_recebimentos_cancelamentos enable row level security;
revoke all on public.financeiro_recebimentos_cancelamentos from public, anon, authenticated;
grant select,insert on public.financeiro_recebimentos_cancelamentos to service_role;

create or replace function public.fn_financeiro_cancelar_recebimento_master_v1(
  p_empresa uuid, p_recebimento uuid, p_venda uuid, p_master uuid, p_justificativa text
) returns jsonb
language plpgsql security definer set search_path='' as $cancelamento$
declare
  v_operador record;
  v_rec public.financeiro_recebimentos%rowtype;
  v_aloc jsonb;
  v_caixa jsonb := '[]'::jsonb;
  v_qtd integer;
  v_aplicado numeric(15,2);
  v_item record;
  v_conta public.financeiro_contas_receber%rowtype;
  v_pago numeric(15,2);
  v_desconto numeric(15,2);
  v_mov record;
begin
  if p_empresa is null or p_recebimento is null or p_venda is null or p_master is null or
     char_length(trim(coalesce(p_justificativa,''))) not between 10 and 1000 then
    raise exception 'Informe justificativa de 10 a 1000 caracteres.';
  end if;
  select id,nome,role,empresa_id into v_operador from public.usuarios
   where id=p_master and empresa_id=p_empresa;
  if not found or v_operador.role<>'master' then
    raise exception 'Somente o Master pode cancelar um recebimento.';
  end if;
  select * into v_rec from public.financeiro_recebimentos
   where id=p_recebimento and empresa_id=p_empresa for update;
  if not found then raise exception 'Recebimento não encontrado nesta empresa.';end if;
  if v_rec.status='cancelado' then raise exception 'O recebimento já está cancelado.';end if;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at),'[]'::jsonb)
    into v_aloc from public.financeiro_recebimento_alocacoes a
    where a.empresa_id=p_empresa and a.recebimento_id=p_recebimento;
  if jsonb_array_length(v_aloc)=0 then
    raise exception 'Recebimento sem parcelas detalhadas: revisão financeira manual obrigatória.';
  end if;
  select count(distinct c.venda_obra_id),coalesce(sum(a.valor) filter(where a.tipo='conta'),0)
    into v_qtd,v_aplicado
    from public.financeiro_recebimento_alocacoes a
    join public.financeiro_contas_receber c on c.id=a.conta_receber_id and c.empresa_id=p_empresa
    where a.recebimento_id=p_recebimento and a.empresa_id=p_empresa;
  if v_qtd<>1 or exists(
    select 1 from public.financeiro_recebimento_alocacoes a
    join public.financeiro_contas_receber c on c.id=a.conta_receber_id
    where a.recebimento_id=p_recebimento and a.empresa_id=p_empresa
      and (c.venda_obra_id is distinct from p_venda or c.cliente_id is distinct from v_rec.cliente_id)
  ) then raise exception 'Recebimento distribuído entre obras ou clientes: revisão manual obrigatória.';end if;
  if abs(v_aplicado-v_rec.valor)>0.01 then
    raise exception 'Valor do recebimento difere das parcelas vinculadas; confira o Financeiro Geral.';
  end if;
  if exists(select 1 from public.financeiro_recebimento_alocacoes a
     where a.recebimento_id=p_recebimento and a.empresa_id=p_empresa and a.tipo not in ('conta','desconto')) then
    raise exception 'Alocação de tipo não reconhecido: revisão manual obrigatória.';
  end if;
  -- Recibos lançados no Caixa não podem sumir de um caixa fechado.
  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at),'[]'::jsonb)
    into v_caixa from public.balcao_caixa_movimentos m
    where m.empresa_id=p_empresa and m.tipo='recebimento'
      and m.descricao like 'Recebimento Atlas '||p_recebimento::text||' - %';
  if jsonb_array_length(v_caixa)>0 and exists (
    select 1 from public.balcao_caixa_movimentos m
    join public.balcao_caixas c on c.id=m.caixa_id and c.empresa_id=p_empresa
    where m.empresa_id=p_empresa and m.tipo='recebimento'
      and m.descricao like 'Recebimento Atlas '||p_recebimento::text||' - %'
      and c.status<>'aberto'
  ) then raise exception 'Caixa de origem já fechado: o estorno exige conferência no Caixa Geral.';end if;
  if jsonb_array_length(v_caixa)>0 and exists(
    select 1 from public.balcao_caixa_movimentos m where m.empresa_id=p_empresa
      and m.descricao like 'Estorno Atlas '||p_recebimento::text||' - %'
  ) then raise exception 'Já existe estorno no Caixa para este recebimento.';end if;
  -- Ajustar parcelas com locks, sem apagar outras baixas do mesmo cliente.
  for v_item in select a.conta_receber_id,
      sum(a.valor) filter(where a.tipo='conta') as recebido,
      sum(a.valor) filter(where a.tipo='desconto') as desconto
    from public.financeiro_recebimento_alocacoes a
    where a.empresa_id=p_empresa and a.recebimento_id=p_recebimento
    group by a.conta_receber_id
    order by a.conta_receber_id
  loop
    select * into v_conta from public.financeiro_contas_receber
      where id=v_item.conta_receber_id and empresa_id=p_empresa for update;
    if not found or v_conta.status='cancelado' then raise exception 'Parcela alterada ou cancelada: revisão manual.';end if;
    v_pago:=round(coalesce(v_conta.valor_pago,0)-coalesce(v_item.recebido,0),2);
    v_desconto:=round(coalesce(v_conta.valor_desconto,0)-coalesce(v_item.desconto,0),2);
    if v_pago < 0 or v_desconto < 0 then
       raise exception 'O saldo das parcelas não permite estorno automático.';
    end if;
    update public.financeiro_contas_receber set
      valor_pago=v_pago,valor_desconto=v_desconto,
      status=case when v_pago+v_desconto>=valor-0.009 then 'pago'
                  when vencimento<current_date then 'vencido' else 'aberto' end,
      data_pagamento=case when v_pago+v_desconto>=valor-0.009 then data_pagamento else null end,
      updated_at=now()
     where id=v_conta.id and empresa_id=p_empresa;
  end loop;
  -- Compensação auditável do movimento no Caixa, somente quando aberto.
  for v_mov in select m.* from public.balcao_caixa_movimentos m
    where m.empresa_id=p_empresa and m.tipo='recebimento'
      and m.descricao like 'Recebimento Atlas '||p_recebimento::text||' - %'
    order by m.id for update
  loop
    if coalesce(v_mov.saida,0)<>0 or coalesce(v_mov.entrada,0)<=0 then
      raise exception 'Movimento de Caixa inválido para estorno automático.';
    end if;
    insert into public.balcao_caixa_movimentos
      (caixa_id,venda_id,tipo,forma_pagamento,entrada,saida,descricao,criado_por_id,criado_por_nome,empresa_id)
    values(v_mov.caixa_id,v_mov.venda_id,'estorno',v_mov.forma_pagamento,0,v_mov.entrada,
     'Estorno Atlas '||p_recebimento::text||' - '||left(trim(p_justificativa),180),
     p_master,v_operador.nome,p_empresa);
  end loop;
  insert into public.financeiro_recebimentos_cancelamentos
    (empresa_id,recebimento_id,venda_obra_id,cliente_id,valor_original,justificativa,
     autorizado_por,autorizado_por_nome,status_anterior,recibo_original,
     alocacoes_originais,caixa_movimentos_originais)
    values(p_empresa,p_recebimento,p_venda,v_rec.cliente_id,v_rec.valor,trim(p_justificativa),
      p_master,v_operador.nome,v_rec.status,to_jsonb(v_rec),v_aloc,v_caixa);
  delete from public.financeiro_recebimento_alocacoes
    where empresa_id=p_empresa and recebimento_id=p_recebimento;
  update public.financeiro_recebimentos
    set status='cancelado',updated_at=now()
    where id=p_recebimento and empresa_id=p_empresa;
  return jsonb_build_object('ok',true,'recebimentoId',p_recebimento,'cancelado',true,
    'valorEstornado',v_rec.valor);
end;$cancelamento$;
revoke all on function public.fn_financeiro_cancelar_recebimento_master_v1(uuid,uuid,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.fn_financeiro_cancelar_recebimento_master_v1(uuid,uuid,uuid,uuid,text)
 to service_role;
