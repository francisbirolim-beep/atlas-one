-- Conciliação pontual de títulos legados após correção auditada da venda.
-- Não altera recebimentos, parcelas quitadas, descontos nem vendas sem revisão.
create table if not exists public.financeiro_venda_conciliacoes_titulo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  venda_obra_id uuid not null references public.vendas_obras(id),
  conta_receber_id uuid not null references public.financeiro_contas_receber(id),
  valor_venda numeric not null,
  valor_titulo_anterior numeric not null,
  valor_titulo_novo numeric not null,
  justificativa text not null,
  executado_por_id uuid not null,
  executado_em timestamptz not null default now()
);
alter table public.financeiro_venda_conciliacoes_titulo enable row level security;
-- A tabela de auditoria não possui acesso direto do cliente; apenas a função validada escreve.
revoke all on table public.financeiro_venda_conciliacoes_titulo from public, anon, authenticated;

create or replace function public.fn_conciliar_titulo_venda_ajustada_v1(
  p_venda_id uuid,
  p_valor_venda_esperado numeric,
  p_valor_titulo_esperado numeric
) returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_usuario uuid := auth.uid();
  v_empresa uuid;
  v_venda public.vendas_obras%rowtype;
  v_conta public.financeiro_contas_receber%rowtype;
  v_qtd integer;
  v_novo numeric;
  v_anterior numeric;
  v_auditoria uuid;
begin
  if v_usuario is null then raise exception 'Sessão inválida'; end if;
  select empresa_id into v_empresa from public.usuarios where id=v_usuario;
  if v_empresa is null or not public.fn_pode_conferir_financeiro_v1(v_empresa) then
    raise exception 'Sem permissão para conciliar o Financeiro';
  end if;
  if p_venda_id is null or p_valor_venda_esperado is null or p_valor_titulo_esperado is null then
    raise exception 'Identificação e valores atuais são obrigatórios';
  end if;

  select * into v_venda from public.vendas_obras
  where id=p_venda_id and empresa_id=v_empresa for update;
  if not found or v_venda.status='cancelada' or v_venda.excluida_em is not null then
    raise exception 'Venda indisponível para conciliação';
  end if;
  v_novo := round(v_venda.valor_venda,2);
  if v_novo<=0 or round(p_valor_venda_esperado,2)<>v_novo then
    raise exception 'O valor da venda mudou. Recarregue antes de conciliar';
  end if;
  if not exists (
    select 1 from public.venda_obra_revisoes r
    where r.empresa_id=v_empresa and r.venda_obra_id=p_venda_id
      and r.tipo='ajuste' and abs(coalesce(r.impacto_valor,0))>0.009
  ) then
    raise exception 'A venda não possui correção de valor auditada';
  end if;

  -- Trava todas as parcelas desta venda para impedir concorrência com baixa/edição.
  perform 1 from public.financeiro_contas_receber
    where empresa_id=v_empresa and venda_obra_id=p_venda_id and status<>'cancelado'
    for update;
  select count(*) into v_qtd from public.financeiro_contas_receber
    where empresa_id=v_empresa and venda_obra_id=p_venda_id and status<>'cancelado';
  if v_qtd<>1 then
    raise exception 'Conciliação automática exige um único título. Use o Financeiro para parcelamentos';
  end if;
  select * into v_conta from public.financeiro_contas_receber
  where empresa_id=v_empresa and venda_obra_id=p_venda_id and status<>'cancelado'
  limit 1 for update;
  if round(v_conta.valor,2) is distinct from round(p_valor_titulo_esperado,2) then
    raise exception 'O valor do título mudou. Atualize a página';
  end if;
  if v_conta.status not in ('aberto','vencido')
      or coalesce(v_conta.valor_pago,0)<>0
      or coalesce(v_conta.valor_desconto,0)<>0
      or v_conta.data_pagamento is not null
      or exists (
        select 1 from public.financeiro_recebimento_alocacoes a
        where a.empresa_id=v_empresa and a.conta_receber_id=v_conta.id
      ) then
    raise exception 'Título com pagamentos, descontos ou baixa: concilie manualmente no Financeiro';
  end if;
  v_anterior := v_conta.valor;
  if round(v_anterior,2)=v_novo then
    return jsonb_build_object('ok',true,'sem_alteracao',true,'valor',v_novo);
  end if;

  update public.financeiro_contas_receber
     set valor=v_novo, updated_at=now()
   where id=v_conta.id and empresa_id=v_empresa;
  insert into public.financeiro_venda_conciliacoes_titulo (
    empresa_id,venda_obra_id,conta_receber_id,valor_venda,
    valor_titulo_anterior,valor_titulo_novo,justificativa,executado_por_id
  ) values (
    v_empresa,p_venda_id,v_conta.id,v_novo,v_anterior,v_novo,
    'Conciliação autorizada do título com o valor comercial já corrigido',v_usuario
  ) returning id into v_auditoria;
  return jsonb_build_object('ok',true,'auditoria_id',v_auditoria,
    'conta_id',v_conta.id,'valor_anterior',v_anterior,'valor_novo',v_novo);
end;
$function$;
revoke execute on function public.fn_conciliar_titulo_venda_ajustada_v1(uuid,numeric,numeric)
  from public, anon;
grant execute on function public.fn_conciliar_titulo_venda_ajustada_v1(uuid,numeric,numeric)
  to authenticated;
