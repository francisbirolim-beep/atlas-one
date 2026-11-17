-- Correcoes auditadas e opcionais, sem modificar as rotinas V1 que ja funcionam.
-- Funcao de venda e conciliacao executa numa unica transacao SQL.
create or replace function public.fn_venda_conferir_valor_financeiro_v2(
 p_venda_id uuid, p_acao text, p_valor numeric, p_valor_anterior numeric,
 p_justificativa text, p_ajustar_parcela boolean default false
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_retorno jsonb;
 v_venda public.vendas_obras%rowtype;
 v_titulo public.financeiro_contas_receber%rowtype;
 v_empresa uuid;
 v_outras numeric;
 v_novo numeric;
 v_anterior numeric;
 v_contas integer;
 v_orcamento_anterior numeric;
begin
 select empresa_id into v_empresa from public.usuarios
 where id=auth.uid() and lower(role)='master';
 if v_empresa is null then raise exception 'Somente o Master pode conciliar uma venda'; end if;
 select * into v_venda from public.vendas_obras
 where id=p_venda_id and empresa_id=v_empresa for update;
 if not found then raise exception 'Venda nao localizada'; end if;
 -- A V1 continua sendo a unica responsavel por validar e auditar o valor da venda.
 -- Uma falha posterior neste bloco desfaz a gravacao feita pela V1.
 v_retorno := public.fn_venda_conferir_valor_wvetro_v1(
   p_venda_id,p_acao,p_valor,p_valor_anterior,p_justificativa
 );
 v_novo := (v_retorno->>'valor_conferido')::numeric;
 -- Corrige tambem o preco comercial do orcamento Atlas, sem modificar o
 -- payload bruto original, materiais, itens nem documentos do W.Vetro.
 -- O carimbo de conferencia impede que o proximo sync reverta a decisao humana.
 select valor_estimado into v_orcamento_anterior from public.orcamentos
 where id=v_venda.orcamento_id and empresa_id=v_empresa for update;
 update public.orcamentos
 set valor_estimado=v_novo,
   wvetro_fluxo=coalesce(wvetro_fluxo,'{}'::jsonb)||jsonb_build_object(
    'valor_venda_conferencia',jsonb_build_object(
      'status','corrigido','acao',p_acao,'valor_original_atlas',v_orcamento_anterior,
      'valor_conferido',v_novo,'conferido_em',now(),
      'conferido_por_id',auth.uid(),'justificativa',p_justificativa)),
   updated_at=now()
 where id=v_venda.orcamento_id and empresa_id=v_empresa;
 update public.venda_obra_revisoes
 set depois=coalesce(depois,'{}'::jsonb)||jsonb_build_object(
    'ajuste_orcamento_atlas',jsonb_build_object(
      'anterior',v_orcamento_anterior,'novo',v_novo,'usuario',auth.uid(),'em',now()))
 where id=(v_retorno->>'revisao_id')::uuid and empresa_id=v_empresa;
 if not coalesce(p_ajustar_parcela,false) then return v_retorno; end if;
 select count(*) into v_contas from public.financeiro_contas_receber
 where empresa_id=v_empresa and venda_obra_id=p_venda_id and status<>'cancelado';
 if v_contas=0 then
   raise exception 'Venda sem titulos financeiros. A correcao precisa ser feita pelo Financeiro';
 end if;
 -- Preserva todas as demais parcelas, principalmente as que ja foram pagas.
 select * into v_titulo from public.financeiro_contas_receber
 where empresa_id=v_empresa and venda_obra_id=p_venda_id
 and status not in ('cancelado','pago')
 order by parcela desc nulls last, created_at desc, id desc limit 1 for update;
 if not found then
   raise exception 'Todas as parcelas estao quitadas; nao e seguro alterar automaticamente seus valores';
 end if;
 select coalesce(sum(valor),0) into v_outras
 from public.financeiro_contas_receber
 where empresa_id=v_empresa and venda_obra_id=p_venda_id
   and status<>'cancelado' and id<>v_titulo.id;
 v_anterior := v_titulo.valor;
 v_novo := round(v_novo - v_outras,2);
 if v_novo<=0 or v_novo<coalesce(v_titulo.valor_pago,0)+coalesce(v_titulo.valor_desconto,0) then
   raise exception 'O novo total ficaria abaixo dos pagamentos ou das outras parcelas. Concilie manualmente';
 end if;
 update public.financeiro_contas_receber
 set valor=v_novo,updated_at=now()
 where id=v_titulo.id and empresa_id=v_empresa;
 update public.venda_obra_revisoes
 set depois=coalesce(depois,'{}'::jsonb)||jsonb_build_object(
   'ajuste_parcela',jsonb_build_object('titulo_id',v_titulo.id,
     'antes',v_anterior,'depois',v_novo,'usuario',auth.uid(),
     'motivo',p_justificativa,'em',now()))
 where id=(v_retorno->>'revisao_id')::uuid
   and empresa_id=v_empresa;
 return v_retorno || jsonb_build_object(
  'financeiro_conciliacao_pendente',false,
  'parcela_ajustada_id',v_titulo.id,
  'valor_parcelas_existentes',(v_outras+v_novo));
end;
$$;
revoke execute on function public.fn_venda_conferir_valor_financeiro_v2(uuid,text,numeric,numeric,text,boolean) from public,anon;
grant execute on function public.fn_venda_conferir_valor_financeiro_v2(uuid,text,numeric,numeric,text,boolean) to authenticated;

-- Antes e depois ficam imutaveis e consultaveis pelo Master; nao exclui o pagamento original.
create table if not exists public.financeiro_recebimentos_correcoes_master (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 venda_obra_id uuid not null,
 recebimento_id uuid not null,
 conta_receber_id uuid not null,
 valor_anterior numeric(14,2) not null,
 valor_novo numeric(14,2) not null,
 justificativa text not null,
 antes jsonb not null,
 depois jsonb not null,
 criado_por_id uuid not null,
 criado_por_nome text,
 created_at timestamptz not null default now()
);
alter table public.financeiro_recebimentos_correcoes_master enable row level security;
revoke all on public.financeiro_recebimentos_correcoes_master from anon,authenticated;
grant select on public.financeiro_recebimentos_correcoes_master to authenticated;
drop policy if exists "master consulta correcoes do tenant" on public.financeiro_recebimentos_correcoes_master;
create policy "master consulta correcoes do tenant"
on public.financeiro_recebimentos_correcoes_master for select to authenticated
using (exists (select 1 from public.usuarios u where u.id=(select auth.uid())
  and u.empresa_id=financeiro_recebimentos_correcoes_master.empresa_id
  and lower(u.role)='master'));

-- So corrigir recibos isolados de uma venda, com uma alocacao de dinheiro.
-- Recebimentos compostos, descontos, pagamentos em outras obras, ou cancelados
-- precisam de conciliacao especifica no Financeiro: nao mudar por aproximacao.
create or replace function public.fn_corrigir_recebimento_venda_master_v1(
 p_venda_id uuid, p_recebimento_id uuid, p_valor_anterior numeric,
 p_valor_novo numeric, p_justificativa text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_usuario uuid:=auth.uid();
 v_empresa uuid;
 v_nome text;
 v_rec public.financeiro_recebimentos%rowtype;
 v_aloc public.financeiro_recebimento_alocacoes%rowtype;
 v_conta public.financeiro_contas_receber%rowtype;
 v_qtd integer;
 v_delta numeric;
 v_novo_pago numeric;
 v_id uuid;
begin
 select empresa_id,nome into v_empresa,v_nome from public.usuarios
 where id=v_usuario and lower(role)='master';
 if v_empresa is null then raise exception 'Somente Master pode corrigir pagamentos'; end if;
 if length(trim(coalesce(p_justificativa,'')))<8 or length(p_justificativa)>500 then
   raise exception 'Justificativa obrigatoria, entre 8 e 500 caracteres'; end if;
 if p_valor_novo is null or p_valor_novo<=0 or p_valor_novo>999999999
    or round(p_valor_novo,2)<>p_valor_novo then
   raise exception 'Valor recebido invalido'; end if;
 if not exists(select 1 from public.vendas_obras
   where id=p_venda_id and empresa_id=v_empresa and status<>'cancelada') then
   raise exception 'Venda nao localizada ou cancelada'; end if;
 select * into v_rec from public.financeiro_recebimentos
 where id=p_recebimento_id and empresa_id=v_empresa for update;
 if not found or v_rec.status in ('cancelado','estornado') then
   raise exception 'Recebimento indisponivel para correcao'; end if;
 if v_rec.valor is distinct from p_valor_anterior then
   raise exception 'O pagamento mudou. Atualize a pagina e confira novamente'; end if;
 if v_rec.valor=p_valor_novo then raise exception 'Informe um valor diferente'; end if;
 select count(*) into v_qtd from public.financeiro_recebimento_alocacoes
 where recebimento_id=p_recebimento_id and empresa_id=v_empresa;
 if v_qtd<>1 then
   raise exception 'Pagamento distribuido ou com desconto: concilie no Financeiro'; end if;
 select * into v_aloc from public.financeiro_recebimento_alocacoes
 where recebimento_id=p_recebimento_id and empresa_id=v_empresa for update;
 if v_aloc.tipo<>'conta' or v_aloc.valor is distinct from v_rec.valor then
   raise exception 'Alocacao composta nao permite correcao direta'; end if;
 select * into v_conta from public.financeiro_contas_receber
 where id=v_aloc.conta_receber_id and empresa_id=v_empresa and venda_obra_id=p_venda_id
   and status<>'cancelado' for update;
 if not found then raise exception 'O pagamento nao pertence a esta venda'; end if;
 v_delta := p_valor_novo - v_rec.valor;
 v_novo_pago := round(coalesce(v_conta.valor_pago,0)+v_delta,2);
 if v_novo_pago<0 or v_novo_pago+coalesce(v_conta.valor_desconto,0)>v_conta.valor+0.009 then
   raise exception 'Correcao excede o saldo da parcela ou gera pagamento negativo'; end if;
 insert into public.financeiro_recebimentos_correcoes_master(
   empresa_id,venda_obra_id,recebimento_id,conta_receber_id,
   valor_anterior,valor_novo,justificativa,antes,depois,criado_por_id,criado_por_nome)
 values (v_empresa,p_venda_id,p_recebimento_id,v_conta.id,
   v_rec.valor,p_valor_novo,trim(p_justificativa),
   jsonb_build_object('recebimento',to_jsonb(v_rec),'alocacao',to_jsonb(v_aloc),'conta',to_jsonb(v_conta)),
   jsonb_build_object('recebimento_valor',p_valor_novo,'alocacao_valor',p_valor_novo,
      'conta_valor_pago',v_novo_pago,'em',now()),v_usuario,v_nome)
 returning id into v_id;
 update public.financeiro_recebimentos set valor=p_valor_novo,updated_at=now()
   where id=p_recebimento_id and empresa_id=v_empresa;
 update public.financeiro_recebimento_alocacoes set valor=p_valor_novo
   where id=v_aloc.id and empresa_id=v_empresa;
 update public.financeiro_contas_receber
 set valor_pago=v_novo_pago,
   status=case when v_novo_pago+coalesce(valor_desconto,0)>=valor-0.009 then 'pago'
          when vencimento is not null and vencimento<current_date then 'vencido'
          else 'aberto' end,
   data_pagamento=case when v_novo_pago+coalesce(valor_desconto,0)>=valor-0.009
       then coalesce(data_pagamento,v_rec.data_recebimento) else null end,
   updated_at=now()
 where id=v_conta.id and empresa_id=v_empresa;
 return jsonb_build_object('ok',true,'correcao_id',v_id,'valor_anterior',v_rec.valor,
   'valor_novo',p_valor_novo,'parcela_id',v_conta.id);
end;
$$;
revoke execute on function public.fn_corrigir_recebimento_venda_master_v1(uuid,uuid,numeric,numeric,text) from public,anon;
grant execute on function public.fn_corrigir_recebimento_venda_master_v1(uuid,uuid,numeric,numeric,text) to authenticated;
