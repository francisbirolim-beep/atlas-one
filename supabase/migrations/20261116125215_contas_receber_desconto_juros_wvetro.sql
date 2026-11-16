-- Ajustes financeiros de baixa por parcela, inspirados na apresentação do W.Vetro.
-- Aditivo: não substitui nem modifica as RPCs de recebimento existentes.
-- Aplicar inicialmente em ambiente de homologação, após backup e testes.
alter table public.financeiro_contas_receber
  add column if not exists valor_juros numeric(14,2) not null default 0;
alter table public.financeiro_recebimentos
  add column if not exists valor_juros numeric(14,2) not null default 0;

alter table public.financeiro_contas_receber
  drop constraint if exists financeiro_contas_receber_valor_juros_nao_negativo;
alter table public.financeiro_contas_receber
  add constraint financeiro_contas_receber_valor_juros_nao_negativo check (valor_juros >= 0);
alter table public.financeiro_recebimentos
  drop constraint if exists financeiro_recebimentos_valor_juros_nao_negativo;
alter table public.financeiro_recebimentos
  add constraint financeiro_recebimentos_valor_juros_nao_negativo check (valor_juros >= 0);

-- Juros acumulados derivam exclusivamente de alocações identificadas.
-- Atualiza também quando se exclui/estorna uma alocação, sem afetar alocações legadas.
create or replace function private.sincronizar_juros_recebimento_v1()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_conta uuid;
  v_rec uuid;
begin
  if tg_op = 'INSERT' and new.tipo <> 'juros' then return new; end if;
  if tg_op = 'DELETE' and old.tipo <> 'juros' then return old; end if;
  if tg_op = 'UPDATE' and old.tipo <> 'juros' and new.tipo <> 'juros' then return new; end if;

  for v_conta in
    select distinct id from unnest(array[
      case when tg_op <> 'INSERT' then old.conta_receber_id else null end,
      case when tg_op <> 'DELETE' then new.conta_receber_id else null end
    ]) as t(id) where id is not null
  loop
    update public.financeiro_contas_receber c
       set valor_juros = coalesce((
         select sum(a.valor) from public.financeiro_recebimento_alocacoes a
          where a.conta_receber_id = v_conta and a.tipo = 'juros'
       ), 0), updated_at = now()
     where c.id = v_conta;
  end loop;

  for v_rec in
    select distinct id from unnest(array[
      case when tg_op <> 'INSERT' then old.recebimento_id else null end,
      case when tg_op <> 'DELETE' then new.recebimento_id else null end
    ]) as t(id) where id is not null
  loop
    update public.financeiro_recebimentos r
       set valor_juros = coalesce((
         select sum(a.valor) from public.financeiro_recebimento_alocacoes a
          where a.recebimento_id = v_rec and a.tipo = 'juros'
       ), 0)
     where r.id = v_rec;
  end loop;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_financeiro_juros_alocacao_v1 on public.financeiro_recebimento_alocacoes;
create trigger trg_financeiro_juros_alocacao_v1
after insert or update or delete on public.financeiro_recebimento_alocacoes
for each row execute function private.sincronizar_juros_recebimento_v1();
revoke all on function private.sincronizar_juros_recebimento_v1() from public, anon, authenticated;

-- Rotina nova e isolada. O fluxo antigo continua sendo usado quando não há juros
-- ou desconto novo e o título não possui juros acumulados.
create or replace function public.registrar_recebimento_cliente_ajustes_v1(
  p_cliente_id uuid,
  p_data_recebimento date,
  p_forma text,
  p_referencia text,
  p_observacoes text,
  p_alocacoes jsonb,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_caixa_id uuid default null
) returns jsonb
language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_empresa uuid;
  v_cliente_nome text;
  v_caixa public.balcao_caixas%rowtype;
  v_conta public.financeiro_contas_receber%rowtype;
  v_rec_id uuid;
  v_item record;
  v_saldo numeric;
  v_saldo_apos numeric;
  v_valor numeric;
  v_desconto numeric;
  v_juros numeric;
  v_total numeric := 0;
  v_total_desconto numeric := 0;
  v_total_juros numeric := 0;
  v_obra_id uuid;
  v_count integer := 0;
begin
  select empresa_id into v_empresa from public.usuarios where id = p_usuario_id;
  if v_empresa is null then raise exception 'Operador inválido.'; end if;
  select nome into v_cliente_nome from public.clientes
    where id = p_cliente_id and empresa_id = v_empresa;
  if v_cliente_nome is null then raise exception 'Cliente fora do escopo da empresa.'; end if;

  perform set_config('request.jwt.claim.sub', p_usuario_id::text, true);
  if private.current_empresa_id() is distinct from v_empresa then
    raise exception 'Contexto da empresa inconsistente.';
  end if;
  if p_data_recebimento is null then raise exception 'Data de recebimento obrigatória.'; end if;
  if lower(coalesce(trim(p_forma),'')) not in (
    'pix','dinheiro','boleto','cartao','cartao_debito','cartao_credito',
    'transferencia','cheque','outro','outros'
  ) then raise exception 'Forma de pagamento inválida.'; end if;
  if p_alocacoes is null or jsonb_typeof(p_alocacoes) <> 'array'
     or jsonb_array_length(p_alocacoes) not between 1 and 100 then
    raise exception 'Informe de 1 a 100 parcelas.';
  end if;
  if (select count(*) from (
    select conta_receber_id from jsonb_to_recordset(p_alocacoes)
    as a(conta_receber_id uuid) group by conta_receber_id having count(*) > 1
  ) d) > 0 then raise exception 'Parcela duplicada.'; end if;

  if p_caixa_id is not null then
    select * into v_caixa from public.balcao_caixas
      where id = p_caixa_id and empresa_id = v_empresa for update;
    if v_caixa.id is null or v_caixa.status <> 'aberto'
       or v_caixa.operador_id is distinct from p_usuario_id then
      raise exception 'O caixa deve estar aberto para o operador.';
    end if;
  end if;

  -- Contas bloqueadas em ordem estável para prevenir corrida de baixas simultâneas.
  for v_item in
    select * from jsonb_to_recordset(p_alocacoes)
      as a(conta_receber_id uuid, valor numeric, desconto numeric, juros numeric)
     order by conta_receber_id
  loop
    v_valor := v_item.valor;
    v_desconto := coalesce(v_item.desconto, 0);
    v_juros := coalesce(v_item.juros, 0);
    if v_item.conta_receber_id is null or v_valor is null or v_valor <= 0
       or v_desconto < 0 or v_juros < 0
       or v_valor <> round(v_valor,2)
       or v_desconto <> round(v_desconto,2)
       or v_juros <> round(v_juros,2) then
      raise exception 'Valores de pagamento, desconto ou juros inválidos.';
    end if;
    select * into v_conta from public.financeiro_contas_receber
      where id = v_item.conta_receber_id and empresa_id = v_empresa
        and cliente_id = p_cliente_id for update;
    if v_conta.id is null or v_conta.status in ('cancelado','pago') then
      raise exception 'Parcela inexistente, cancelada ou já quitada.';
    end if;
    v_saldo := round(v_conta.valor + coalesce(v_conta.valor_juros,0)
      - coalesce(v_conta.valor_pago,0) - coalesce(v_conta.valor_desconto,0),2);
    if v_saldo <= 0 or v_valor + v_desconto > v_saldo + v_juros + 0.009
 then
      raise exception 'Recebimento e ajustes ultrapassam o saldo da parcela.';
    end if;
    v_total := v_total + v_valor;
    v_total_desconto := v_total_desconto + v_desconto;
    v_total_juros := v_total_juros + v_juros;
    v_count := v_count + 1;
  end loop;

  if v_total <= 0 or v_total > 100000000 then raise exception 'Total fora do limite.'; end if;
  select case when count(distinct c.obra_id) = 1 and count(*) = count(c.obra_id)
    then (array_agg(distinct c.obra_id))[1] else null end into v_obra_id
    from public.financeiro_contas_receber c
    join jsonb_to_recordset(p_alocacoes) as a(conta_receber_id uuid)
      on a.conta_receber_id = c.id;

  insert into public.financeiro_recebimentos (
    empresa_id, cliente_id, cliente_nome, obra_id, data_recebimento,
    valor, valor_desconto, valor_juros, forma, referencia, observacoes,
    criado_por_id, criado_por_nome
  ) values (
    v_empresa, p_cliente_id, v_cliente_nome, v_obra_id, p_data_recebimento,
    v_total, 0, 0, p_forma, nullif(trim(p_referencia),''),
    nullif(trim(p_observacoes),''), p_usuario_id, p_usuario_nome
  ) returning id into v_rec_id;

  for v_item in
    select * from jsonb_to_recordset(p_alocacoes)
      as a(conta_receber_id uuid, valor numeric, desconto numeric, juros numeric)
     order by conta_receber_id
  loop
    v_valor := v_item.valor;
    v_desconto := coalesce(v_item.desconto, 0);
    v_juros := coalesce(v_item.juros, 0);
    select * into v_conta from public.financeiro_contas_receber
      where id = v_item.conta_receber_id and empresa_id = v_empresa for update;

    insert into public.financeiro_recebimento_alocacoes (
      empresa_id, recebimento_id, conta_receber_id, obra_id, tipo,
      valor, criado_por_id, criado_por_nome
    ) values (
      v_empresa, v_rec_id, v_conta.id, v_conta.obra_id, 'conta',
      v_valor, p_usuario_id, p_usuario_nome
    );
    if v_desconto > 0 then
      insert into public.financeiro_recebimento_alocacoes (
        empresa_id, recebimento_id, conta_receber_id, obra_id, tipo,
        valor, criado_por_id, criado_por_nome
      ) values (
        v_empresa, v_rec_id, v_conta.id, v_conta.obra_id, 'desconto',
        v_desconto, p_usuario_id, p_usuario_nome
      );
    end if;
    if v_juros > 0 then
      insert into public.financeiro_recebimento_alocacoes (
        empresa_id, recebimento_id, conta_receber_id, obra_id, tipo,
        valor, criado_por_id, criado_por_nome
      ) values (
        v_empresa, v_rec_id, v_conta.id, v_conta.obra_id, 'juros',
        v_juros, p_usuario_id, p_usuario_nome
      );
    end if;

    v_saldo_apos := round(v_conta.valor + coalesce(v_conta.valor_juros,0) + v_juros
      - coalesce(v_conta.valor_pago,0) - v_valor
      - coalesce(v_conta.valor_desconto,0) - v_desconto, 2);
    update public.financeiro_contas_receber
       set valor_pago = coalesce(valor_pago,0) + v_valor,
           status = case when v_saldo_apos <= 0.009 then 'pago' else 'aberto' end,
           data_pagamento = case when v_saldo_apos <= 0.009
             then p_data_recebimento else data_pagamento end,
           forma = p_forma, updated_at = now()
     where id = v_conta.id and empresa_id = v_empresa;

    if p_caixa_id is not null then
      insert into public.balcao_caixa_movimentos (
        empresa_id, caixa_id, venda_id, tipo, forma_pagamento, entrada, saida,
        descricao, criado_por_id, criado_por_nome
      ) values (
        v_empresa, v_caixa.id, v_conta.venda_balcao_id, 'recebimento',
        p_forma, v_valor, 0,
        'Recebimento Atlas ' || v_rec_id::text || ' - ' ||
          coalesce(v_conta.documento, 'Parcela') || ' ' ||
          coalesce(v_conta.parcela::text,'1') || '/' ||
          coalesce(v_conta.total_parcelas::text,'1'),
        p_usuario_id, p_usuario_nome
      );
    end if;
  end loop;

  return jsonb_build_object('ok',true,'recebimento_id',v_rec_id,
    'valor',v_total,'desconto',v_total_desconto,'juros',v_total_juros,
    'parcelas',v_count,'origem',case when p_caixa_id is null then 'cliente' else 'caixa' end);
end;
$$;
revoke all on function public.registrar_recebimento_cliente_ajustes_v1(uuid,date,text,text,text,jsonb,uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function public.registrar_recebimento_cliente_ajustes_v1(uuid,date,text,text,text,jsonb,uuid,text,uuid)
  to service_role;
