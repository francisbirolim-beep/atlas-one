-- Sincronização conservadora do preço da venda com o Contas a Receber.
-- Não substitui/gera títulos e nunca altera baixas, descontos ou recebimentos.
-- Para múltiplas parcelas sem movimentação, ajusta somente a última parcela ainda aberta.
create table if not exists public.financeiro_ajustes_valor_venda (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  venda_obra_id uuid not null references public.vendas_obras(id),
  conta_receber_id uuid not null references public.financeiro_contas_receber(id),
  valor_venda numeric(15,2) not null,
  total_titulos_anterior numeric(15,2) not null,
  total_titulos_novo numeric(15,2) not null,
  parcela_valor_anterior numeric(15,2) not null,
  parcela_valor_novo numeric(15,2) not null,
  origem text not null check (origem in ('alteracao_preco','conciliacao_confirmada')),
  usuario_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists financeiro_ajustes_valor_venda_venda_idx
  on public.financeiro_ajustes_valor_venda (empresa_id,venda_obra_id,created_at desc);
alter table public.financeiro_ajustes_valor_venda enable row level security;
revoke all on public.financeiro_ajustes_valor_venda from public,anon,authenticated;
grant select,insert on public.financeiro_ajustes_valor_venda to service_role;

create or replace function public.fn_financeiro_conciliar_valor_venda_v1(
 p_empresa uuid,p_venda uuid,p_origem text default 'conciliacao_confirmada',p_usuario uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 v_venda record;
 v_total numeric(15,2);
 v_diferenca numeric(15,2);
 v_total_contas integer;
 v_inseguras integer;
 v_tem_alocacoes boolean;
 v_ultima record;
 v_valor_novo numeric(15,2);
begin
 if p_empresa is null or p_venda is null or p_origem not in ('alteracao_preco','conciliacao_confirmada') then
    raise exception 'Parâmetros financeiros inválidos.';
 end if;
 select id,empresa_id,valor_venda into v_venda
 from public.vendas_obras where id=p_venda and empresa_id=p_empresa for update;
 if not found then raise exception 'Venda não encontrada nesta empresa.';end if;
 if v_venda.valor_venda is null or v_venda.valor_venda<=0 then
   return jsonb_build_object('ok',false,'codigo','valor_venda_invalido','motivo','Valor da venda inválido para conciliação.');
 end if;
 select count(*),coalesce(sum(c.valor),0)::numeric(15,2),
   count(*) filter(where c.status not in ('aberto','vencido')
      or coalesce(c.valor_pago,0)<>0 or coalesce(c.valor_desconto,0)<>0)
 into v_total_contas,v_total,v_inseguras
 from public.financeiro_contas_receber c
 where c.venda_obra_id=p_venda and c.empresa_id=p_empresa and c.status<>'cancelado';
 if v_total_contas=0 then
   return jsonb_build_object('ok',false,'codigo','sem_titulos','motivo','A venda ainda não possui títulos ativos. Nenhuma conta foi criada.');
 end if;
 v_diferenca:=round(v_venda.valor_venda-v_total,2);
 if abs(v_diferenca)<0.01 then
   return jsonb_build_object('ok',true,'codigo','ja_conciliado','valor',v_total);
 end if;
 select exists(
   select 1 from public.financeiro_recebimento_alocacoes a
   join public.financeiro_contas_receber c on c.id=a.conta_receber_id
   where c.venda_obra_id=p_venda and c.empresa_id=p_empresa
 ) into v_tem_alocacoes;
 if v_inseguras>0 or v_tem_alocacoes then
   return jsonb_build_object('ok',false,'codigo','movimentacao_existente',
    'motivo','Há parcelas pagas, descontos ou recebimentos vinculados. Confira os lançamentos antes de ajustar os títulos.');
 end if;
 select c.id,c.valor,c.parcela,c.status,c.valor_pago,c.valor_desconto into v_ultima
 from public.financeiro_contas_receber c
 where c.venda_obra_id=p_venda and c.empresa_id=p_empresa and c.status in ('aberto','vencido')
 order by c.parcela desc nulls last,c.created_at desc,c.id desc
 limit 1 for update;
 if not found then
   return jsonb_build_object('ok',false,'codigo','sem_parcela_aberta','motivo','Nenhuma parcela pode ser ajustada com segurança.');
 end if;
 -- Segunda checagem APÓS o lock: um pagamento pode ter ocorrido durante a leitura inicial.
 select exists(select 1 from public.financeiro_recebimento_alocacoes a
   where a.conta_receber_id=v_ultima.id) into v_tem_alocacoes;
 if coalesce(v_ultima.valor_pago,0)<>0 or coalesce(v_ultima.valor_desconto,0)<>0
    or v_ultima.status not in ('aberto','vencido') or v_tem_alocacoes then
   return jsonb_build_object('ok',false,'codigo','parcela_movimentada',
     'motivo','A parcela recebeu pagamento ou desconto durante a conciliação. Atualize a tela.');
 end if;
 v_valor_novo:=round(v_ultima.valor+v_diferenca,2);
 if v_valor_novo<0 then
   return jsonb_build_object('ok',false,'codigo','revisao_parcelas',
    'motivo','O valor da venda é inferior às demais parcelas. É necessária uma revisão manual da distribuição.');
 end if;
 update public.financeiro_contas_receber
  set valor=v_valor_novo,updated_at=now()
  where id=v_ultima.id and empresa_id=p_empresa and valor=v_ultima.valor;
 if not found then raise exception 'A parcela mudou durante a conciliação. Tente novamente.';end if;
 insert into public.financeiro_ajustes_valor_venda
  (empresa_id,venda_obra_id,conta_receber_id,valor_venda,total_titulos_anterior,
   total_titulos_novo,parcela_valor_anterior,parcela_valor_novo,origem,usuario_id)
 values(p_empresa,p_venda,v_ultima.id,round(v_venda.valor_venda,2),v_total,
  round(v_total+v_diferenca,2),v_ultima.valor,v_valor_novo,p_origem,p_usuario);
 return jsonb_build_object('ok',true,'codigo','conciliado','totalAnterior',v_total,
  'totalNovo',round(v_total+v_diferenca,2),'parcelaAjustada',v_ultima.id);
end;$fn$;
revoke all on function public.fn_financeiro_conciliar_valor_venda_v1(uuid,uuid,text,uuid)
 from public,anon,authenticated;
grant execute on function public.fn_financeiro_conciliar_valor_venda_v1(uuid,uuid,text,uuid) to service_role;

create or replace function private.fn_financeiro_sincronizar_valor_venda_v1()
returns trigger language plpgsql security definer set search_path='' as $trigger$
begin
 if new.valor_venda is distinct from old.valor_venda then
   perform public.fn_financeiro_conciliar_valor_venda_v1(
      new.empresa_id,new.id,'alteracao_preco',auth.uid());
 end if;
 return new;
end;$trigger$;
drop trigger if exists trg_financeiro_sincronizar_preco_venda_v1 on public.vendas_obras;
create trigger trg_financeiro_sincronizar_preco_venda_v1
 after update of valor_venda on public.vendas_obras
 for each row when(old.valor_venda is distinct from new.valor_venda)
 execute function private.fn_financeiro_sincronizar_valor_venda_v1();
revoke all on function private.fn_financeiro_sincronizar_valor_venda_v1()
 from public,anon,authenticated;
