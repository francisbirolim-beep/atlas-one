-- Ajustes auditáveis dos títulos a receber, separados dos recebimentos pagos.
-- Somente Master. Nunca apagar parcelas; zero/cancelamento preservam histórico e comprovantes.
create table if not exists public.financeiro_ajustes_titulos_manuais (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id),
 venda_obra_id uuid not null references public.vendas_obras(id),
 conta_receber_id uuid not null references public.financeiro_contas_receber(id),
 acao text not null check(acao in ('alterar','zerar','cancelar')),
 valor_anterior numeric(15,2) not null,
 valor_novo numeric(15,2) not null,
 status_anterior text not null,
 status_novo text not null,
 justificativa text not null check(length(trim(justificativa)) between 10 and 1000),
 autorizado_por uuid not null,
 autorizado_por_nome text not null,
 criado_em timestamptz not null default now()
);
create index if not exists financeiro_ajustes_titulos_manuais_venda_idx
 on public.financeiro_ajustes_titulos_manuais(empresa_id,venda_obra_id,criado_em desc);
alter table public.financeiro_ajustes_titulos_manuais enable row level security;
revoke all on public.financeiro_ajustes_titulos_manuais from public,anon,authenticated;
grant select,insert on public.financeiro_ajustes_titulos_manuais to service_role;

create or replace function public.fn_financeiro_ajustar_titulo_master_v1(
 p_empresa uuid,p_venda uuid,p_conta uuid,p_master uuid,
 p_acao text,p_valor numeric,p_justificativa text,p_valor_esperado numeric
) returns jsonb language plpgsql security definer set search_path='' as $ajuste$
declare
 v_usuario record;
 v_conta public.financeiro_contas_receber%rowtype;
 v_valor numeric(15,2);
 v_status text;
begin
 if p_empresa is null or p_venda is null or p_conta is null or p_master is null or
   p_acao not in ('alterar','zerar','cancelar') or
   length(trim(coalesce(p_justificativa,''))) not between 10 and 1000 then
    raise exception 'Ação inválida ou justificativa insuficiente (10 a 1000 caracteres).';
 end if;
 select id,nome,role into v_usuario from public.usuarios
   where id=p_master and empresa_id=p_empresa;
 if not found or v_usuario.role<>'master' then
    raise exception 'Somente Master pode ajustar títulos financeiros.';
 end if;
 -- Lock da venda para impedir concorrência com o registro de recebimentos.
 perform 1 from public.vendas_obras where id=p_venda and empresa_id=p_empresa for update;
 if not found then raise exception 'Venda não encontrada.';end if;
 select * into v_conta from public.financeiro_contas_receber
   where id=p_conta and venda_obra_id=p_venda and empresa_id=p_empresa for update;
 if not found then raise exception 'Título não encontrado na venda.';end if;
 if v_conta.status not in ('aberto','vencido') or
    coalesce(v_conta.valor_pago,0)<>0 or coalesce(v_conta.valor_desconto,0)<>0 then
    raise exception 'Título possui movimentação ou está fechado. Corrija o recebimento separadamente.';
 end if;
 if exists(select 1 from public.financeiro_recebimento_alocacoes
   where conta_receber_id=p_conta and empresa_id=p_empresa) then
    raise exception 'Título vinculado a recebimento; não pode ser ajustado diretamente.';
 end if;
 if p_valor_esperado is null or round(p_valor_esperado,2)<>round(v_conta.valor,2) then
    raise exception 'O valor foi alterado desde a última consulta. Atualize a página.';
 end if;
 if p_acao='alterar' then
    if p_valor is null or p_valor<=0 or p_valor>999999999999.99 then
      raise exception 'Informe valor maior que zero. Use Zerar ou Cancelar para anular.';
    end if;
    v_valor:=round(p_valor,2);v_status:=v_conta.status;
 elsif p_acao='zerar' then
    v_valor:=0;v_status:='cancelado';
 else
    v_valor:=v_conta.valor;v_status:='cancelado';
 end if;
 if v_valor=v_conta.valor and v_status=v_conta.status then
    return jsonb_build_object('ok',true,'codigo','sem_alteracao');
 end if;
 update public.financeiro_contas_receber
  set valor=v_valor,status=v_status,updated_at=now()
  where id=p_conta and empresa_id=p_empresa;
 insert into public.financeiro_ajustes_titulos_manuais
  (empresa_id,venda_obra_id,conta_receber_id,acao,valor_anterior,valor_novo,
   status_anterior,status_novo,justificativa,autorizado_por,autorizado_por_nome)
 values(p_empresa,p_venda,p_conta,p_acao,v_conta.valor,v_valor,v_conta.status,v_status,
  trim(p_justificativa),p_master,v_usuario.nome);
 return jsonb_build_object('ok',true,'acao',p_acao,'valorAnterior',v_conta.valor,
  'valorNovo',v_valor,'statusNovo',v_status);
end;$ajuste$;
revoke all on function public.fn_financeiro_ajustar_titulo_master_v1(uuid,uuid,uuid,uuid,text,numeric,text,numeric)
 from public,anon,authenticated;
grant execute on function public.fn_financeiro_ajustar_titulo_master_v1(uuid,uuid,uuid,uuid,text,numeric,text,numeric)
 to service_role;
