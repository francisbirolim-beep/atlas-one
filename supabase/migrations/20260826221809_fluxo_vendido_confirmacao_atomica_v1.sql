-- Garante que o orçamento só entra de verdade em Vendido depois da confirmação.
-- A confirmação cria/garante somente Venda + Financeiro + Conferir Projeto.
-- Etapas posteriores continuam dependendo de Projeto conferido / Medição Final aprovada.

create or replace function public.fn_iniciar_fluxo_venda_v2(
  p_orcamento_id uuid,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
)
returns table(venda_id uuid, projeto_card_id uuid, conta_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orc public.orcamentos%rowtype;
  v_venda_id uuid;
  v_projeto_id uuid;
  v_fin_card uuid;
  v_conta_id uuid;
  v_coluna_vendido_id uuid;
  v_desc text;
begin
  perform pg_advisory_xact_lock(hashtext(p_orcamento_id::text));

  select * into v_orc
    from public.orcamentos
   where id = p_orcamento_id
   for update;

  if not found then
    raise exception 'Orçamento não encontrado';
  end if;
  if v_orc.cliente_id is null then
    raise exception 'Cliente precisa estar vinculado antes da confirmação da venda';
  end if;
  if coalesce(v_orc.modo_entrada, '') = 'balcao' then
    raise exception 'Venda Balcão não usa o fluxo operacional de obras';
  end if;

  insert into public.vendas_obras(
    orcamento_id,
    cliente_id,
    obra_id,
    valor_venda,
    custo_previsto,
    condicoes_snapshot,
    forma_pagamento_snapshot,
    itens_snapshot,
    confirmado_por_id,
    confirmado_por_nome
  ) values (
    v_orc.id,
    v_orc.cliente_id,
    v_orc.obra_id,
    coalesce(v_orc.valor_estimado, 0),
    v_orc.custo_estimado,
    v_orc.condicoes,
    v_orc.forma_pagamento,
    coalesce(v_orc.itens, '[]'::jsonb),
    p_usuario_id,
    p_usuario_nome
  )
  on conflict (orcamento_id) do nothing;

  select id into v_venda_id
    from public.vendas_obras
   where orcamento_id = v_orc.id;

  select id into v_conta_id
    from public.financeiro_contas_receber
   where orcamento_id = v_orc.id
     and status <> 'cancelado'
   order by created_at asc
   limit 1
   for update;

  if v_conta_id is null then
    insert into public.financeiro_contas_receber(
      venda_obra_id,
      cliente_id,
      cliente_nome,
      documento,
      parcela,
      total_parcelas,
      data_emissao,
      vencimento,
      valor,
      status,
      forma,
      valor_pago,
      observacoes,
      criado_por_id,
      criado_por_nome,
      obra_id,
      orcamento_id
    ) values (
      v_venda_id,
      v_orc.cliente_id,
      v_orc.cliente_nome,
      'Venda sob medida' || case when v_orc.numero is not null then ' - Orçamento #' || v_orc.numero else '' end,
      1,
      1,
      current_date,
      null,
      coalesce(v_orc.valor_estimado, 0),
      'aberto',
      v_orc.forma_pagamento,
      0,
      'Pré-lançamento criado na confirmação da venda. Financeiro pode ajustar parcelas, vencimentos e condições mantendo o histórico da venda.',
      p_usuario_id,
      p_usuario_nome,
      v_orc.obra_id,
      v_orc.id
    )
    returning id into v_conta_id;
  else
    update public.financeiro_contas_receber
       set venda_obra_id = coalesce(venda_obra_id, v_venda_id),
           obra_id = coalesce(obra_id, v_orc.obra_id),
           updated_at = now()
     where id = v_conta_id;
  end if;

  v_desc := concat_ws(E'\n',
    'VENDA CONFIRMADA',
    'Cliente: ' || coalesce(v_orc.cliente_nome, 'Não informado'),
    case when v_orc.numero is not null then 'Orçamento: #' || v_orc.numero else null end,
    case when v_orc.obra_id is not null then 'Obra vinculada: ' || v_orc.obra_id::text else 'Obra: não vinculada' end,
    '',
    'CONFERIR PROJETO',
    'Revisar tipologias, montagem, perfis, acessórios, ferragens, sentido de abertura, medidas de projeto e demais definições técnicas antes de liberar compras e Medição Final.'
  );

  v_projeto_id := public.fn_fluxo_upsert_card_setor_v1(
    'engenharia-projeto',
    v_orc.id,
    v_orc.cliente_nome,
    v_desc,
    p_usuario_id,
    p_usuario_nome
  );

  v_fin_card := public.fn_fluxo_upsert_card_setor_v1(
    'financeiro',
    v_orc.id,
    v_orc.cliente_nome,
    concat_ws(E'\n',
      'VENDA CONFIRMADA',
      'Valor: R$ ' || to_char(coalesce(v_orc.valor_estimado, 0), 'FM999G999G990D00'),
      coalesce('Condições: ' || nullif(v_orc.condicoes, ''), null),
      coalesce('Forma: ' || nullif(v_orc.forma_pagamento, ''), null)
    ),
    p_usuario_id,
    p_usuario_nome
  );

  select id into v_coluna_vendido_id
    from public.kanban_colunas
   where coalesce(gera_medicao_final, false) = true
   order by ordem asc
   limit 1;

  update public.orcamentos
     set status = 'vendido',
         coluna_id = coalesce(v_coluna_vendido_id, coluna_id),
         coluna_atualizada_em = case when v_coluna_vendido_id is not null then now() else coluna_atualizada_em end,
         updated_at = now()
   where id = v_orc.id;

  if v_orc.obra_id is not null then
    update public.obras
       set status = 'engenharia',
           updated_at = now()
     where id = v_orc.obra_id;
  end if;

  return query select v_venda_id, v_projeto_id, v_conta_id;
end;
$$;

revoke execute on function public.fn_iniciar_fluxo_venda_v2(uuid, uuid, text) from public, anon;
grant execute on function public.fn_iniciar_fluxo_venda_v2(uuid, uuid, text) to authenticated;
