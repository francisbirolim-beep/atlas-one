-- PDV Balcão — não inventar vencimento de boleto/venda a prazo.
-- Substitui apenas a função de finalização criada na migration anterior.

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
set search_path = public
as $$
declare
  v_caixa record;
  v_item jsonb;
  v_pag jsonb;
  v_prod record;
  v_saldo record;
  v_venda_id uuid;
  v_numero bigint;
  v_qtd numeric;
  v_preco numeric;
  v_subtotal numeric := 0;
  v_total numeric;
  v_pagamentos_total numeric := 0;
  v_custo numeric;
  v_margem numeric;
  v_forma text;
  v_valor numeric;
  v_parcelas integer;
  v_parcela_valor numeric;
  v_primeiro_vencimento date;
  v_intervalo_dias integer;
  i integer;
begin
  select * into v_caixa from public.balcao_caixas where id=p_caixa_id for update;
  if v_caixa.id is null or v_caixa.status <> 'aberto' then raise exception 'Caixa não está aberto.'; end if;
  if coalesce(p_usuario_role,'') <> 'master' and v_caixa.operador_id <> p_usuario_id then
    raise exception 'Este caixa foi aberto por outro operador.';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens)=0 then raise exception 'Venda sem itens.'; end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := nullif(v_item->>'quantidade','')::numeric;
    v_preco := nullif(v_item->>'precoUnitario','')::numeric;
    if v_qtd is null or v_qtd <= 0 then raise exception 'Quantidade inválida.'; end if;
    if v_preco is null or v_preco < 0 then raise exception 'Preço inválido.'; end if;

    select id,codigo,nome,unidade,custo,preco,preco_minimo into v_prod
      from public.produtos where id=(v_item->>'produtoId')::uuid and ativo=true;
    if v_prod.id is null then raise exception 'Produto não encontrado ou inativo.'; end if;
    if v_prod.preco_minimo is not null and v_preco < v_prod.preco_minimo and not p_permitir_abaixo_minimo then
      raise exception 'Preço abaixo do mínimo permitido para %.', v_prod.nome;
    end if;
    select * into v_saldo from public.estoque_saldos where produto_id=v_prod.id for update;
    if v_saldo.produto_id is null then raise exception 'Produto % ainda não possui saldo de estoque.', v_prod.nome; end if;
    if v_saldo.quantidade < v_qtd then raise exception 'Estoque insuficiente para %. Disponível: %.', v_prod.nome, v_saldo.quantidade; end if;
    v_subtotal := v_subtotal + (v_qtd * v_preco);
  end loop;

  if coalesce(p_desconto,0) < 0 or coalesce(p_desconto,0) > v_subtotal then raise exception 'Desconto inválido.'; end if;
  v_total := round(v_subtotal - coalesce(p_desconto,0), 2);

  if jsonb_typeof(p_pagamentos) <> 'array' or jsonb_array_length(p_pagamentos)=0 then raise exception 'Informe o pagamento.'; end if;
  for v_pag in select * from jsonb_array_elements(p_pagamentos) loop
    v_valor := nullif(v_pag->>'valor','')::numeric;
    if v_valor is null or v_valor <= 0 then raise exception 'Valor de pagamento inválido.'; end if;
    v_forma := lower(trim(v_pag->>'forma'));
    if v_forma in ('boleto','a_prazo') and nullif(v_pag->>'primeiroVencimento','') is null then
      raise exception 'Informe o primeiro vencimento do pagamento a prazo.';
    end if;
    v_pagamentos_total := v_pagamentos_total + v_valor;
  end loop;
  if abs(v_pagamentos_total - v_total) > 0.01 then raise exception 'Pagamentos não fecham com o total da venda.'; end if;

  insert into public.balcao_vendas(cliente_id,cliente_nome,vendedor_id,vendedor_nome,caixa_id,subtotal,desconto,total,observacoes)
  values(p_cliente_id,nullif(trim(p_cliente_nome),''),p_usuario_id,p_usuario_nome,p_caixa_id,round(v_subtotal,2),coalesce(p_desconto,0),v_total,p_observacoes)
  returning id,numero into v_venda_id,v_numero;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd := (v_item->>'quantidade')::numeric;
    v_preco := (v_item->>'precoUnitario')::numeric;
    select id,codigo,nome,unidade,custo,preco,preco_minimo into v_prod from public.produtos where id=(v_item->>'produtoId')::uuid;
    select * into v_saldo from public.estoque_saldos where produto_id=v_prod.id for update;
    v_custo := coalesce(v_saldo.custo_medio,v_prod.custo,0);
    v_margem := case when v_preco > 0 then round(((v_preco-v_custo)/v_preco*100)::numeric,4) else null end;

    insert into public.balcao_venda_itens(venda_id,produto_id,produto_codigo,produto_nome,unidade,quantidade,custo_unitario_snapshot,preco_tabela_snapshot,preco_unitario,preco_minimo_snapshot,total_item,margem_real_percentual)
    values(v_venda_id,v_prod.id,v_prod.codigo,v_prod.nome,coalesce(v_saldo.unidade,v_prod.unidade),v_qtd,v_custo,v_prod.preco,v_preco,v_prod.preco_minimo,round(v_qtd*v_preco,2),v_margem);

    update public.estoque_saldos set quantidade=quantidade-v_qtd,
      valor_estoque=greatest(0,(quantidade-v_qtd)*coalesce(custo_medio,0)), updated_at=now()
      where produto_id=v_prod.id;
    insert into public.estoque_movimentos(produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,origem_tipo,origem_id,observacoes,criado_por_id,criado_por_nome)
    values(v_prod.id,'saida',v_qtd,coalesce(v_saldo.unidade,v_prod.unidade),v_custo,v_qtd*v_custo,'venda_balcao',v_venda_id,'Venda balcão #'||v_numero,p_usuario_id,p_usuario_nome);
    update public.produtos set ultimo_preco_vendido=v_preco, ultimo_preco_vendido_em=now(), updated_at=now() where id=v_prod.id;
  end loop;

  for v_pag in select * from jsonb_array_elements(p_pagamentos) loop
    v_forma := lower(trim(v_pag->>'forma'));
    v_valor := (v_pag->>'valor')::numeric;
    v_parcelas := greatest(1,coalesce(nullif(v_pag->>'parcelas','')::integer,1));
    if v_forma not in ('dinheiro','pix','cartao_debito','cartao_credito','boleto','a_prazo','outros') then raise exception 'Forma de pagamento inválida.'; end if;
    insert into public.balcao_pagamentos(venda_id,forma,valor,parcelas,detalhes)
    values(v_venda_id,v_forma,v_valor,v_parcelas,nullif(v_pag->>'detalhes',''));

    if v_forma in ('dinheiro','pix','cartao_debito','cartao_credito','outros') then
      insert into public.balcao_caixa_movimentos(caixa_id,venda_id,tipo,forma_pagamento,entrada,descricao,criado_por_id,criado_por_nome)
      values(p_caixa_id,v_venda_id,'recebimento',v_forma,v_valor,'Venda balcão #'||v_numero,p_usuario_id,p_usuario_nome);
    else
      v_primeiro_vencimento := nullif(v_pag->>'primeiroVencimento','')::date;
      if v_primeiro_vencimento is null then raise exception 'Informe o primeiro vencimento do pagamento a prazo.'; end if;
      v_intervalo_dias := greatest(1,coalesce(nullif(v_pag->>'intervaloDias','')::integer,30));
      v_parcela_valor := round(v_valor / v_parcelas, 2);
      for i in 1..v_parcelas loop
        insert into public.financeiro_contas_receber(venda_balcao_id,cliente_id,cliente_nome,documento,parcela,total_parcelas,vencimento,valor,forma,observacoes,criado_por_id,criado_por_nome)
        values(v_venda_id,p_cliente_id,nullif(trim(p_cliente_nome),''),'VBC-'||v_numero,i,v_parcelas,
          v_primeiro_vencimento + ((i-1)*v_intervalo_dias),
          case when i=v_parcelas then v_valor - (v_parcela_valor*(v_parcelas-1)) else v_parcela_valor end,
          v_forma,'Gerado pela venda balcão #'||v_numero,p_usuario_id,p_usuario_nome);
      end loop;
    end if;
  end loop;

  return jsonb_build_object('ok',true,'vendaId',v_venda_id,'numero',v_numero,'subtotal',round(v_subtotal,2),'total',v_total);
end;
$$;
revoke all on function public.finalizar_venda_balcao(uuid,uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) from public,anon,authenticated;
grant execute on function public.finalizar_venda_balcao(uuid,uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) to service_role;
