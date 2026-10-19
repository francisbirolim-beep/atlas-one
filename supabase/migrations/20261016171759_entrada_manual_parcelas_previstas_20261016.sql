-- Entrada manual: cada parcela possui valor, vencimento e meio previsto.
-- Adição isolada; preserva a RPC antiga e a entrada por nota fiscal.
begin;

alter table public.financeiro_contas_pagar
  add column if not exists forma_pagamento_prevista text;

-- O índice antigo permite somente uma conta por entrada manual.
-- A nova chave permite N parcelas sem permitir títulos repetidos.
drop index if exists public.uq_contas_pagar_entrada_manual;
create unique index if not exists uq_contas_pagar_manual_parcela
  on public.financeiro_contas_pagar(entrada_manual_id, parcela)
  where entrada_manual_id is not null;

create or replace function public.registrar_entrada_manual_romaneio_parcelado(
  p_empresa_id uuid, p_usuario_id uuid, p_chave_idempotencia uuid,
  p_fornecedor_nome text, p_numero_romaneio text, p_data_documento date,
  p_observacoes text, p_itens jsonb, p_parcelas jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_resultado jsonb;
  v_parcela jsonb;
  v_numero integer := 0;
  v_quantidade integer;
  v_valor numeric;
  v_total_parcelas numeric := 0;
  v_valor_total numeric;
  v_vencimento date;
  v_forma text;
  v_entrada uuid;
  v_conta uuid;
  v_ids jsonb := '[]'::jsonb;
begin
  if p_parcelas is null or jsonb_typeof(p_parcelas) <> 'array'
     or jsonb_array_length(p_parcelas) not between 1 and 36 then
    raise exception 'Informe de 1 a 36 parcelas';
  end if;
  v_quantidade := jsonb_array_length(p_parcelas);

  -- A gravação de mercadorias e a divisão do financeiro fazem parte
  -- da mesma transação. Em qualquer erro, tudo é revertido.
  v_resultado := public.registrar_entrada_manual_romaneio_dividido(
    p_empresa_id, p_usuario_id, p_chave_idempotencia,
    p_fornecedor_nome, p_numero_romaneio, p_data_documento,
    p_observacoes, (p_parcelas->0->>'vencimento')::date, p_itens
  );
  if coalesce((v_resultado->>'duplicado')::boolean, false) then
    return v_resultado;
  end if;

  v_valor_total := (v_resultado->>'valorTotal')::numeric;
  v_entrada := (v_resultado->>'entradaId')::uuid;
  v_conta := (v_resultado->>'contaPagarId')::uuid;

  for v_parcela in select value from jsonb_array_elements(p_parcelas) loop
    v_numero := v_numero + 1;
    if jsonb_typeof(v_parcela) <> 'object'
       or coalesce(v_parcela->>'valor','') !~ '^[0-9]+([.][0-9]{1,2})?$'
       or coalesce(v_parcela->>'vencimento','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Parcela %: informe valor em centavos e vencimento válido', v_numero;
    end if;
    v_valor := (v_parcela->>'valor')::numeric;
    v_vencimento := (v_parcela->>'vencimento')::date;
    v_forma := lower(btrim(coalesce(v_parcela->>'forma','')));
    if v_valor <= 0 or v_valor > 1000000000
       or v_forma not in ('boleto','pix','cheque') then
      raise exception 'Parcela %: informe valor positivo e forma boleto, pix ou cheque', v_numero;
    end if;
    v_total_parcelas := v_total_parcelas + v_valor;
  end loop;

  if v_total_parcelas <> v_valor_total then
    raise exception 'A soma das parcelas deve ser igual ao total do romaneio';
  end if;

  v_numero := 0;
  for v_parcela in select value from jsonb_array_elements(p_parcelas) loop
    v_numero := v_numero + 1;
    v_valor := (v_parcela->>'valor')::numeric;
    v_vencimento := (v_parcela->>'vencimento')::date;
    v_forma := lower(btrim(v_parcela->>'forma'));
    if v_numero = 1 then
      update public.financeiro_contas_pagar
        set parcela = v_numero::text || '/' || v_quantidade::text,
            vencimento = v_vencimento, valor = v_valor,
            forma_pagamento_prevista = v_forma,
            status = 'aberto', updated_at = now()
      where id = v_conta and entrada_manual_id = v_entrada
        and empresa_id = p_empresa_id;
      if not found then raise exception 'Conta original não encontrada'; end if;
    else
      insert into public.financeiro_contas_pagar(
        empresa_id, fornecedor_nome, documento, parcela, descricao,
        data_emissao, vencimento, valor, status, origem,
        criado_por_id, criado_por_nome, entrada_manual_id,
        forma_pagamento_prevista
      ) values (
        p_empresa_id, btrim(p_fornecedor_nome),
        'ROM ' || btrim(p_numero_romaneio),
        v_numero::text || '/' || v_quantidade::text,
        'Recebimento por romaneio', p_data_documento,
        v_vencimento, v_valor, 'aberto', 'entrada_manual_romaneio',
        p_usuario_id,
        (select nome from public.usuarios where id=p_usuario_id and empresa_id=p_empresa_id),
        v_entrada, v_forma
      ) returning id into v_conta;
    end if;
    v_ids := v_ids || jsonb_build_array(v_conta);
  end loop;

  return v_resultado || jsonb_build_object(
    'parcelasRegistradas', v_quantidade, 'contasPagarIds', v_ids
  );
end;
$$;

revoke all on function public.registrar_entrada_manual_romaneio_parcelado(
  uuid,uuid,uuid,text,text,date,text,jsonb,jsonb
) from public,anon,authenticated;
grant execute on function public.registrar_entrada_manual_romaneio_parcelado(
  uuid,uuid,uuid,text,text,date,text,jsonb,jsonb
) to service_role;