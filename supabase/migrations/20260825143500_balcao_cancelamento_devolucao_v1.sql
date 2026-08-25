-- Atlas One — Venda Balcão: cancelamento e devolução V1
-- Operação auditável e idempotente, com estoque, reservas, financeiro e reembolso.

create table if not exists public.balcao_venda_eventos (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.balcao_vendas(id) on delete restrict,
  tipo text not null check (tipo in ('cancelamento_total','devolucao_parcial','reembolso_pendente','reembolso_concluido')),
  status text not null default 'concluido' check (status in ('concluido','pendente','cancelado')),
  motivo text not null,
  observacoes text,
  valor numeric not null default 0 check (valor >= 0),
  usuario_id uuid not null references auth.users(id),
  usuario_nome text not null,
  dados jsonb not null default '{}'::jsonb,
  concluido_em timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.balcao_venda_evento_itens (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.balcao_venda_eventos(id) on delete cascade,
  venda_item_id uuid not null references public.balcao_venda_itens(id) on delete restrict,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  quantidade numeric not null check (quantidade > 0),
  valor_liquido numeric not null default 0 check (valor_liquido >= 0),
  local_retorno_id uuid references public.estoque_locais(id) on delete restrict,
  acao_estoque text not null check (acao_estoque in ('entrada','liberar_reserva','nenhuma')),
  created_at timestamptz not null default now()
);

create index if not exists idx_balcao_eventos_venda on public.balcao_venda_eventos(venda_id,created_at desc);
create index if not exists idx_balcao_eventos_status on public.balcao_venda_eventos(status,tipo,created_at desc);
create index if not exists idx_balcao_evento_itens_item on public.balcao_venda_evento_itens(venda_item_id,created_at desc);

alter table public.balcao_venda_eventos enable row level security;
alter table public.balcao_venda_evento_itens enable row level security;
revoke all on public.balcao_venda_eventos from anon, authenticated;
revoke all on public.balcao_venda_evento_itens from anon, authenticated;
grant all on public.balcao_venda_eventos to service_role;
grant all on public.balcao_venda_evento_itens to service_role;

create or replace function public.processar_cancelamento_devolucao_balcao(
  p_venda_id uuid,
  p_tipo text,
  p_itens jsonb,
  p_motivo text,
  p_observacoes text,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_reembolsar_caixa boolean default false,
  p_caixa_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_venda record;
  v_item record;
  v_req jsonb;
  v_evento_id uuid;
  v_pendente_id uuid;
  v_qtd numeric;
  v_qtd_anterior numeric;
  v_qtd_disponivel numeric;
  v_local_retorno uuid;
  v_acao text;
  v_valor_item numeric;
  v_valor_evento numeric := 0;
  v_fator_liquido numeric := 1;
  v_reserva record;
  v_saldo record;
  v_liberar numeric;
  v_restante numeric;
  v_conta record;
  v_saldo_conta numeric;
  v_reembolso numeric := 0;
  v_reembolso_caixa numeric := 0;
  v_reembolso_pendente numeric := 0;
  v_caixa_disponivel numeric := 0;
  v_caixa record;
  v_restam_itens integer := 0;
  v_pendentes_fin jsonb := '[]'::jsonb;
begin
  if p_tipo not in ('cancelamento_total','devolucao_parcial') then raise exception 'Tipo de operação inválido.'; end if;
  if nullif(trim(coalesce(p_motivo,'')),'') is null then raise exception 'Informe o motivo.'; end if;

  select * into v_venda from public.balcao_vendas where id=p_venda_id for update;
  if v_venda.id is null then raise exception 'Venda não encontrada.'; end if;
  if v_venda.status='cancelada' then raise exception 'Venda já cancelada.'; end if;
  if v_venda.subtotal>0 then v_fator_liquido:=greatest(0,(v_venda.total/v_venda.subtotal)); end if;

  insert into public.balcao_venda_eventos(venda_id,tipo,status,motivo,observacoes,usuario_id,usuario_nome)
  values(p_venda_id,p_tipo,'concluido',trim(p_motivo),nullif(trim(coalesce(p_observacoes,'')),''),p_usuario_id,p_usuario_nome)
  returning id into v_evento_id;

  for v_item in select * from public.balcao_venda_itens where venda_id=p_venda_id order by created_at,id for update loop
    select coalesce(sum(ei.quantidade),0) into v_qtd_anterior
      from public.balcao_venda_evento_itens ei
      join public.balcao_venda_eventos e on e.id=ei.evento_id
      where ei.venda_item_id=v_item.id and e.status='concluido' and e.tipo in ('cancelamento_total','devolucao_parcial');
    v_qtd_disponivel:=greatest(0,v_item.quantidade-v_qtd_anterior);
    if v_qtd_disponivel<=0 then continue; end if;

    if p_tipo='cancelamento_total' then
      v_qtd:=v_qtd_disponivel;
      v_local_retorno:=coalesce(v_item.local_origem_id,v_venda.local_estoque_id);
    else
      select x into v_req from jsonb_array_elements(coalesce(p_itens,'[]'::jsonb)) x where x->>'itemId'=v_item.id::text limit 1;
      if v_req is null then continue; end if;
      v_qtd:=coalesce(nullif(v_req->>'quantidade','')::numeric,0);
      v_local_retorno:=coalesce(nullif(v_req->>'localRetornoId','')::uuid,v_item.local_origem_id,v_venda.local_estoque_id);
      if v_qtd<=0 then continue; end if;
      if v_qtd>v_qtd_disponivel then raise exception 'Quantidade devolvida excede o saldo do item %.',v_item.produto_nome; end if;
      if v_item.atendimento_status in ('reservado_outra_unidade','separando') then
        raise exception 'Devolução parcial não é permitida enquanto % está reservado/separando. Use cancelamento total ou conclua o atendimento.',v_item.produto_nome;
      end if;
    end if;

    if v_item.atendimento_status in ('reservado_outra_unidade','separando') then
      v_acao:='liberar_reserva';
      v_restante:=v_qtd;
      for v_reserva in
        select * from public.estoque_reservas
        where origem_tipo='venda_balcao' and origem_id=p_venda_id and produto_id=v_item.produto_id
          and local_id=v_item.local_origem_id and status='ativa'
        order by created_at,id for update
      loop
        exit when v_restante<=0;
        v_liberar:=least(v_restante,v_reserva.quantidade);
        select * into v_saldo from public.estoque_saldos
          where produto_id=v_item.produto_id and local_id=v_reserva.local_id
            and (endereco_id is not distinct from v_reserva.endereco_id) for update;
        if v_saldo.id is null or v_saldo.quantidade_reservada<v_liberar then raise exception 'Reserva inconsistente para %.',v_item.produto_nome; end if;
        update public.estoque_saldos set quantidade_reservada=quantidade_reservada-v_liberar,updated_at=now() where id=v_saldo.id;
        if v_liberar>=v_reserva.quantidade then
          update public.estoque_reservas set status='cancelada',updated_at=now(),observacoes=concat_ws(E'\n',observacoes,'Liberada por cancelamento/devolução da venda balcão.') where id=v_reserva.id;
        else
          update public.estoque_reservas set quantidade=quantidade-v_liberar,updated_at=now(),observacoes=concat_ws(E'\n',observacoes,'Reserva reduzida por cancelamento/devolução da venda balcão.') where id=v_reserva.id;
        end if;
        v_restante:=v_restante-v_liberar;
      end loop;
      if v_restante>0 then raise exception 'Não foi possível liberar toda a reserva de %.',v_item.produto_nome; end if;
    else
      v_acao:='entrada';
      if v_local_retorno is null then raise exception 'Informe o local de retorno para %.',v_item.produto_nome; end if;
      select * into v_saldo from public.estoque_saldos where produto_id=v_item.produto_id and local_id=v_local_retorno and endereco_id is null for update;
      if v_saldo.id is null then
        insert into public.estoque_saldos(produto_id,local_id,endereco_id,unidade,quantidade,quantidade_reservada,custo_medio,valor_estoque)
        values(v_item.produto_id,v_local_retorno,null,v_item.unidade,v_qtd,0,coalesce(v_item.custo_unitario_snapshot,0),v_qtd*coalesce(v_item.custo_unitario_snapshot,0))
        returning * into v_saldo;
      else
        update public.estoque_saldos set quantidade=quantidade+v_qtd,
          valor_estoque=valor_estoque+(v_qtd*coalesce(v_item.custo_unitario_snapshot,custo_medio,0)),updated_at=now()
          where id=v_saldo.id;
      end if;
      insert into public.estoque_movimentos(produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,origem_tipo,origem_id,observacoes,criado_por_id,criado_por_nome,local_destino_id)
      values(v_item.produto_id,'entrada',v_qtd,v_item.unidade,coalesce(v_item.custo_unitario_snapshot,0),v_qtd*coalesce(v_item.custo_unitario_snapshot,0),
        'devolucao_venda_balcao',v_evento_id,'Retorno da venda balcão #'||v_venda.numero,p_usuario_id,p_usuario_nome,v_local_retorno);
    end if;

    v_valor_item:=round(v_qtd*v_item.preco_unitario*v_fator_liquido,2);
    v_valor_evento:=v_valor_evento+v_valor_item;
    insert into public.balcao_venda_evento_itens(evento_id,venda_item_id,produto_id,quantidade,valor_liquido,local_retorno_id,acao_estoque)
      values(v_evento_id,v_item.id,v_item.produto_id,v_qtd,v_valor_item,v_local_retorno,v_acao);
  end loop;

  if v_valor_evento<=0 then raise exception 'Nenhum item disponível para cancelar/devolver.'; end if;

  -- Primeiro reduz/cancela títulos ainda em aberto, preservando títulos pagos.
  v_reembolso:=v_valor_evento;
  for v_conta in
    select * from public.financeiro_contas_receber
    where venda_balcao_id=p_venda_id and status in ('aberto','vencido')
    order by vencimento desc,id for update
  loop
    exit when v_reembolso<=0;
    v_saldo_conta:=greatest(0,v_conta.valor-coalesce(v_conta.valor_pago,0));
    if v_saldo_conta<=0 then continue; end if;
    if v_reembolso+0.001>=v_saldo_conta then
      update public.financeiro_contas_receber set status='cancelado',updated_at=now(),
        observacoes=concat_ws(E'\n',observacoes,'Cancelado/reduzido pela devolução da venda balcão #'||v_venda.numero) where id=v_conta.id;
      v_reembolso:=v_reembolso-v_saldo_conta;
    else
      update public.financeiro_contas_receber set valor=greatest(coalesce(valor_pago,0),valor-v_reembolso),updated_at=now(),
        observacoes=concat_ws(E'\n',observacoes,'Valor reduzido pela devolução da venda balcão #'||v_venda.numero) where id=v_conta.id;
      v_reembolso:=0;
    end if;
  end loop;

  -- O restante já foi recebido e precisa ser reembolsado/creditado.
  if v_reembolso>0 and p_reembolsar_caixa then
    select coalesce(sum(entrada),0)-coalesce(sum(saida) filter(where tipo='estorno'),0) into v_caixa_disponivel
      from public.balcao_caixa_movimentos
      where venda_id=p_venda_id and (tipo='estorno' or (tipo='recebimento' and coalesce(forma_pagamento,'') not in ('cartao_debito','cartao_credito')));
    v_reembolso_caixa:=least(v_reembolso,greatest(0,v_caixa_disponivel));
    if v_reembolso_caixa>0 then
      if p_caixa_id is null then raise exception 'Informe um caixa aberto para efetuar o reembolso.'; end if;
      select * into v_caixa from public.balcao_caixas where id=p_caixa_id for update;
      if v_caixa.id is null or v_caixa.status<>'aberto' then raise exception 'Caixa informado não está aberto.'; end if;
      insert into public.balcao_caixa_movimentos(caixa_id,venda_id,tipo,forma_pagamento,saida,descricao,criado_por_id,criado_por_nome)
      values(p_caixa_id,p_venda_id,'estorno','reembolso',v_reembolso_caixa,'Reembolso da venda balcão #'||v_venda.numero,p_usuario_id,p_usuario_nome);
    end if;
  end if;
  v_reembolso_pendente:=greatest(0,v_reembolso-v_reembolso_caixa);

  update public.balcao_venda_eventos set valor=round(v_valor_evento,2),concluido_em=now(),
    dados=jsonb_build_object('reembolso_caixa',round(v_reembolso_caixa,2),'reembolso_pendente',round(v_reembolso_pendente,2))
    where id=v_evento_id;

  if v_reembolso_pendente>0 then
    insert into public.balcao_venda_eventos(venda_id,tipo,status,motivo,observacoes,valor,usuario_id,usuario_nome,dados)
    values(p_venda_id,'reembolso_pendente','pendente','Reembolso pendente após '||case when p_tipo='cancelamento_total' then 'cancelamento' else 'devolução' end,
      'Confirmar posteriormente quando o valor for devolvido ao cliente.',round(v_reembolso_pendente,2),p_usuario_id,p_usuario_nome,jsonb_build_object('evento_origem_id',v_evento_id))
    returning id into v_pendente_id;
  end if;

  select count(*) into v_restam_itens from public.balcao_venda_itens vi
  where vi.venda_id=p_venda_id and vi.quantidade > coalesce((
    select sum(ei.quantidade) from public.balcao_venda_evento_itens ei join public.balcao_venda_eventos e on e.id=ei.evento_id
    where ei.venda_item_id=vi.id and e.status='concluido' and e.tipo in ('cancelamento_total','devolucao_parcial')
  ),0);

  if v_restam_itens=0 then
    update public.balcao_vendas set status='cancelada',atendimento_status='cancelado',cancelada_em=now(),cancelada_por_id=p_usuario_id,
      cancelada_por_nome=p_usuario_nome,motivo_cancelamento=p_motivo where id=p_venda_id;
    update public.balcao_venda_itens set atendimento_status='cancelado' where venda_id=p_venda_id;
  else
    update public.balcao_vendas set status='devolvida_parcial',atendimento_status=case when atendimento_status='cancelado' then 'parcial' else atendimento_status end where id=p_venda_id;
  end if;

  return jsonb_build_object('ok',true,'eventoId',v_evento_id,'valor',round(v_valor_evento,2),
    'reembolsoCaixa',round(v_reembolso_caixa,2),'reembolsoPendente',round(v_reembolso_pendente,2),'reembolsoPendenteId',v_pendente_id,
    'statusVenda',case when v_restam_itens=0 then 'cancelada' else 'devolvida_parcial' end);
end;
$$;

create or replace function public.concluir_reembolso_balcao(
  p_evento_id uuid,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_movimentar_caixa boolean default false,
  p_caixa_id uuid default null,
  p_observacoes text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_evento record;
  v_venda record;
  v_caixa record;
  v_novo_id uuid;
begin
  select * into v_evento from public.balcao_venda_eventos where id=p_evento_id for update;
  if v_evento.id is null or v_evento.tipo<>'reembolso_pendente' then raise exception 'Reembolso pendente não encontrado.'; end if;
  if v_evento.status<>'pendente' then raise exception 'Este reembolso já foi concluído ou cancelado.'; end if;
  select * into v_venda from public.balcao_vendas where id=v_evento.venda_id;
  if p_movimentar_caixa then
    if p_caixa_id is null then raise exception 'Informe o caixa.'; end if;
    select * into v_caixa from public.balcao_caixas where id=p_caixa_id for update;
    if v_caixa.id is null or v_caixa.status<>'aberto' then raise exception 'Caixa informado não está aberto.'; end if;
    insert into public.balcao_caixa_movimentos(caixa_id,venda_id,tipo,forma_pagamento,saida,descricao,criado_por_id,criado_por_nome)
    values(p_caixa_id,v_evento.venda_id,'estorno','reembolso',v_evento.valor,'Conclusão de reembolso da venda balcão #'||v_venda.numero,p_usuario_id,p_usuario_nome);
  end if;
  update public.balcao_venda_eventos set status='concluido',concluido_em=now(),observacoes=concat_ws(E'\n',observacoes,nullif(trim(coalesce(p_observacoes,'')),'')) where id=p_evento_id;
  insert into public.balcao_venda_eventos(venda_id,tipo,status,motivo,observacoes,valor,usuario_id,usuario_nome,dados,concluido_em)
  values(v_evento.venda_id,'reembolso_concluido','concluido','Reembolso confirmado',nullif(trim(coalesce(p_observacoes,'')),''),v_evento.valor,p_usuario_id,p_usuario_nome,
    jsonb_build_object('evento_pendente_id',p_evento_id,'movimentou_caixa',p_movimentar_caixa),now()) returning id into v_novo_id;
  return jsonb_build_object('ok',true,'eventoId',v_novo_id,'valor',v_evento.valor);
end;
$$;

revoke all on function public.processar_cancelamento_devolucao_balcao(uuid,text,jsonb,text,text,uuid,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.processar_cancelamento_devolucao_balcao(uuid,text,jsonb,text,text,uuid,text,boolean,uuid) to service_role;
revoke all on function public.concluir_reembolso_balcao(uuid,uuid,text,boolean,uuid,text) from public,anon,authenticated;
grant execute on function public.concluir_reembolso_balcao(uuid,uuid,text,boolean,uuid,text) to service_role;
