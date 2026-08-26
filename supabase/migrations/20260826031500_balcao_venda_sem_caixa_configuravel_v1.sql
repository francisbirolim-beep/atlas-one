alter table public.balcao_vendas alter column caixa_id drop not null;

insert into public.configuracoes_gerais(chave, valor, updated_at)
values ('balcao_exigir_caixa_aberto','false',now())
on conflict (chave) do nothing;

create or replace function public.finalizar_venda_balcao_sem_caixa(
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
as $function$
declare
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
  v_local_padrao_id uuid;
  v_unidade_padrao_id uuid;
  v_atendimento_item text;
  v_atendimento_venda text := 'entregue';
  v_reservas_pendentes integer := 0;
  v_itens_aguardando_estoque integer := 0;
  v_disponivel numeric;
  v_global_sem_estoque boolean := true;
  v_permitir_sem_estoque boolean;
  v_sem_estoque boolean;
  i integer;
begin
  select coalesce((select lower(trim(valor)) in ('1','true','sim','yes','on') from public.configuracoes_gerais where chave='balcao_permitir_venda_sem_estoque' limit 1), true) into v_global_sem_estoque;
  if jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then raise exception 'Venda sem itens.'; end if;

  v_local_padrao_id := nullif((p_itens->0)->>'localOrigemId','')::uuid;
  if v_local_padrao_id is null then
    select l.id, l.unidade_id into v_local_padrao_id, v_unidade_padrao_id from public.estoque_locais l join public.unidades_operacionais u on u.id=l.unidade_id where l.ativo=true and l.permite_venda=true order by case when u.codigo='MATRIZ' and l.codigo='GERAL' then 0 else 1 end, l.created_at limit 1;
  else
    select unidade_id into v_unidade_padrao_id from public.estoque_locais where id=v_local_padrao_id and ativo=true and permite_venda=true;
  end if;
  if v_local_padrao_id is null or v_unidade_padrao_id is null then raise exception 'Nenhum local de estoque disponível para a venda.'; end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd:=nullif(v_item->>'quantidade','')::numeric; v_preco:=nullif(v_item->>'precoUnitario','')::numeric; v_local_origem_id:=coalesce(nullif(v_item->>'localOrigemId','')::uuid,v_local_padrao_id);
    if v_qtd is null or v_qtd<=0 then raise exception 'Quantidade inválida.'; end if;
    if v_preco is null or v_preco<=0 then raise exception 'Preço inválido.'; end if;
    select id,codigo,nome,unidade,custo,preco,preco_minimo,permite_venda_sem_estoque into v_prod from public.produtos where id=(v_item->>'produtoId')::uuid and ativo=true;
    if v_prod.id is null then raise exception 'Produto não encontrado ou inativo.'; end if;
    if v_prod.preco_minimo is not null and v_preco<v_prod.preco_minimo and not p_permitir_abaixo_minimo then raise exception 'Preço abaixo do mínimo permitido para %.',v_prod.nome; end if;
    select l.id,l.ativo,l.permite_venda,u.nome as unidade_nome,l.nome as local_nome into v_local from public.estoque_locais l join public.unidades_operacionais u on u.id=l.unidade_id where l.id=v_local_origem_id;
    if v_local.id is null or not v_local.ativo or not v_local.permite_venda then raise exception 'Local de estoque indisponível para venda.'; end if;
    select coalesce(sum(greatest(0,quantidade-quantidade_reservada)),0) into v_disponivel from public.estoque_saldos where produto_id=v_prod.id and local_id=v_local_origem_id;
    v_permitir_sem_estoque:=coalesce(v_prod.permite_venda_sem_estoque,v_global_sem_estoque);
    if v_disponivel<v_qtd and not v_permitir_sem_estoque then raise exception 'Estoque disponível insuficiente para % em % / %. Disponível: %.',v_prod.nome,v_local.unidade_nome,v_local.local_nome,v_disponivel; end if;
    v_subtotal:=v_subtotal+(v_qtd*v_preco);
  end loop;

  if coalesce(p_desconto,0)<0 or coalesce(p_desconto,0)>v_subtotal then raise exception 'Desconto inválido.'; end if;
  v_total:=round(v_subtotal-coalesce(p_desconto,0),2);
  if jsonb_typeof(p_pagamentos)<>'array' or jsonb_array_length(p_pagamentos)=0 then raise exception 'Informe o pagamento.'; end if;
  for v_pag in select * from jsonb_array_elements(p_pagamentos) loop
    v_valor:=nullif(v_pag->>'valor','')::numeric; if v_valor is null or v_valor<=0 then raise exception 'Valor de pagamento inválido.'; end if;
    v_forma:=lower(trim(v_pag->>'forma')); if v_forma in ('boleto','a_prazo') and nullif(v_pag->>'primeiroVencimento','') is null then raise exception 'Informe o primeiro vencimento do pagamento a prazo.'; end if;
    v_pagamentos_total:=v_pagamentos_total+v_valor;
  end loop;
  if abs(v_pagamentos_total-v_total)>0.01 then raise exception 'Pagamentos não fecham com o total da venda.'; end if;

  insert into public.balcao_vendas(cliente_id,cliente_nome,vendedor_id,vendedor_nome,caixa_id,unidade_id,local_estoque_id,subtotal,desconto,total,observacoes,atendimento_status)
  values(p_cliente_id,nullif(trim(p_cliente_nome),''),p_usuario_id,p_usuario_nome,null,v_unidade_padrao_id,v_local_padrao_id,round(v_subtotal,2),coalesce(p_desconto,0),v_total,concat_ws(E'\n',nullif(trim(p_observacoes),''),'Venda finalizada sem caixa aberto.'),'entregue') returning id,numero into v_venda_id,v_numero;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_qtd:=(v_item->>'quantidade')::numeric; v_preco:=(v_item->>'precoUnitario')::numeric; v_local_origem_id:=coalesce(nullif(v_item->>'localOrigemId','')::uuid,v_local_padrao_id);
    select id,codigo,nome,unidade,custo,preco,preco_minimo,permite_venda_sem_estoque into v_prod from public.produtos where id=(v_item->>'produtoId')::uuid;
    v_permitir_sem_estoque:=coalesce(v_prod.permite_venda_sem_estoque,v_global_sem_estoque);
    select coalesce(sum(greatest(0,quantidade-quantidade_reservada)),0) into v_disponivel from public.estoque_saldos where produto_id=v_prod.id and local_id=v_local_origem_id;
    v_sem_estoque:=v_disponivel<v_qtd;
    if v_sem_estoque then
      if not v_permitir_sem_estoque then raise exception 'Estoque disponível insuficiente para %.',v_prod.nome; end if;
      v_custo:=coalesce(v_prod.custo,0); v_margem:=case when v_preco>0 then round(((v_preco-v_custo)/v_preco*100)::numeric,4) else null end; v_atendimento_item:='aguardando_estoque'; v_atendimento_venda:='aguardando_estoque'; v_itens_aguardando_estoque:=v_itens_aguardando_estoque+1;
    else
      v_reserva:=public.reservar_estoque_local(v_prod.id,v_local_origem_id,v_qtd,'venda_balcao',v_venda_id,p_cliente_id,'Reserva da venda balcão #'||v_numero,null,p_usuario_id,p_usuario_nome);
      if coalesce((v_reserva->>'ok')::boolean,false)=false then
        if v_permitir_sem_estoque then v_custo:=coalesce(v_prod.custo,0); v_margem:=case when v_preco>0 then round(((v_preco-v_custo)/v_preco*100)::numeric,4) else null end; v_atendimento_item:='aguardando_estoque'; v_atendimento_venda:='aguardando_estoque'; v_itens_aguardando_estoque:=v_itens_aguardando_estoque+1; v_sem_estoque:=true;
        else raise exception 'Não foi possível reservar estoque para %. Disponível: %.',v_prod.nome,coalesce(v_reserva->>'disponivel','0'); end if;
      end if;
      if not v_sem_estoque then
        v_custo_total:=0; v_qtd_custo:=0;
        for v_r in select * from public.estoque_reservas where origem_tipo='venda_balcao' and origem_id=v_venda_id and produto_id=v_prod.id and local_id=v_local_origem_id and status='ativa' order by created_at,id for update loop
          select * into v_s from public.estoque_saldos where produto_id=v_prod.id and local_id=v_local_origem_id and (endereco_id is not distinct from v_r.endereco_id) for update;
          if v_s.id is null or v_s.quantidade<v_r.quantidade or v_s.quantidade_reservada<v_r.quantidade then raise exception 'Saldo reservado inconsistente para %.',v_prod.nome; end if;
          v_custo_total:=v_custo_total+(v_r.quantidade*coalesce(v_s.custo_medio,v_prod.custo,0)); v_qtd_custo:=v_qtd_custo+v_r.quantidade;
          if v_local_origem_id=v_local_padrao_id then
            update public.estoque_saldos set quantidade=quantidade-v_r.quantidade,quantidade_reservada=quantidade_reservada-v_r.quantidade,valor_estoque=greatest(0,valor_estoque-(v_r.quantidade*coalesce(custo_medio,0))),updated_at=now() where id=v_s.id;
            insert into public.estoque_movimentos(produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,origem_tipo,origem_id,observacoes,criado_por_id,criado_por_nome,local_origem_id,endereco_origem_id)
            values(v_prod.id,'saida',v_r.quantidade,coalesce(v_s.unidade,v_prod.unidade),coalesce(v_s.custo_medio,v_prod.custo,0),v_r.quantidade*coalesce(v_s.custo_medio,v_prod.custo,0),'venda_balcao',v_venda_id,'Venda balcão #'||v_numero||' sem caixa',p_usuario_id,p_usuario_nome,v_local_origem_id,v_r.endereco_id);
            update public.estoque_reservas set status='atendida',updated_at=now() where id=v_r.id;
          end if;
        end loop;
        v_custo:=case when v_qtd_custo>0 then v_custo_total/v_qtd_custo else coalesce(v_prod.custo,0) end; v_margem:=case when v_preco>0 then round(((v_preco-v_custo)/v_preco*100)::numeric,4) else null end;
        if v_local_origem_id=v_local_padrao_id then v_atendimento_item:='entregue'; else v_atendimento_item:='reservado_outra_unidade'; if v_atendimento_venda<>'aguardando_estoque' then v_atendimento_venda:='aguardando_separacao'; end if; v_reservas_pendentes:=v_reservas_pendentes+1; end if;
      end if;
    end if;
    insert into public.balcao_venda_itens(venda_id,produto_id,produto_codigo,produto_nome,unidade,quantidade,custo_unitario_snapshot,preco_tabela_snapshot,preco_unitario,preco_minimo_snapshot,total_item,margem_real_percentual,local_origem_id,atendimento_status)
    values(v_venda_id,v_prod.id,v_prod.codigo,v_prod.nome,v_prod.unidade,v_qtd,v_custo,v_prod.preco,v_preco,v_prod.preco_minimo,round(v_qtd*v_preco,2),v_margem,v_local_origem_id,v_atendimento_item);
    update public.produtos set ultimo_preco_vendido=v_preco,ultimo_preco_vendido_em=now(),updated_at=now() where id=v_prod.id;
  end loop;
  update public.balcao_vendas set atendimento_status=v_atendimento_venda where id=v_venda_id;

  for v_pag in select * from jsonb_array_elements(p_pagamentos) loop
    v_forma:=lower(trim(v_pag->>'forma')); v_valor:=(v_pag->>'valor')::numeric; v_parcelas:=greatest(1,coalesce(nullif(v_pag->>'parcelas','')::integer,1));
    if v_forma not in ('dinheiro','pix','cartao_debito','cartao_credito','boleto','a_prazo','outros') then raise exception 'Forma de pagamento inválida.'; end if;
    insert into public.balcao_pagamentos(venda_id,forma,valor,parcelas,detalhes) values(v_venda_id,v_forma,v_valor,v_parcelas,concat_ws(' · ',nullif(v_pag->>'detalhes',''),'Sem caixa aberto'));
    if v_forma in ('boleto','a_prazo') then
      v_primeiro_vencimento:=nullif(v_pag->>'primeiroVencimento','')::date; if v_primeiro_vencimento is null then raise exception 'Informe o primeiro vencimento do pagamento a prazo.'; end if;
      v_intervalo_dias:=greatest(1,coalesce(nullif(v_pag->>'intervaloDias','')::integer,30)); v_parcela_valor:=round(v_valor/v_parcelas,2);
      for i in 1..v_parcelas loop
        insert into public.financeiro_contas_receber(venda_balcao_id,cliente_id,cliente_nome,documento,parcela,total_parcelas,vencimento,valor,forma,observacoes,criado_por_id,criado_por_nome)
        values(v_venda_id,p_cliente_id,nullif(trim(p_cliente_nome),''),'VBC-'||v_numero,i,v_parcelas,v_primeiro_vencimento+((i-1)*v_intervalo_dias),case when i=v_parcelas then v_valor-(v_parcela_valor*(v_parcelas-1)) else v_parcela_valor end,v_forma,'Gerado pela venda balcão #'||v_numero||' sem caixa',p_usuario_id,p_usuario_nome);
      end loop;
    end if;
  end loop;

  return jsonb_build_object('ok',true,'vendaId',v_venda_id,'numero',v_numero,'subtotal',round(v_subtotal,2),'total',v_total,'atendimentoStatus',v_atendimento_venda,'reservasPendentes',v_reservas_pendentes,'itensAguardandoEstoque',v_itens_aguardando_estoque,'semCaixa',true);
end;
$function$;

grant execute on function public.finalizar_venda_balcao_sem_caixa(uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) to authenticated, service_role;
