-- Inclusão controlada: usuários com edição no Portal do Cliente também podem excluir vendas
-- com motivo obrigatório, confirmação por número e auditoria. Bloqueios de pagamento,
-- instalação, produção e cotação são integralmente preservados.
-- A função continua SECURITY INVOKER e executável somente pelo serviço interno.
CREATE OR REPLACE FUNCTION public.excluir_venda_incorreta_v1(p_empresa uuid, p_usuario uuid, p_venda uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_role text; v_nome text; v_venda public.vendas_obras%rowtype;
 v_contas_canceladas integer := 0;
begin
 if char_length(btrim(coalesce(p_motivo,''))) not between 8 and 1000 then
  raise exception 'Informe motivo entre 8 e 1000 caracteres'; end if;
 select role,nome into v_role,v_nome from public.usuarios
  where id=p_usuario and empresa_id=p_empresa;
 -- Master ou funcionário com edição no Portal do Cliente e ação não negada.
 -- A API também confere essa autorização; a RPC a revalida de modo independente.
 if v_role is null then raise exception 'Usuário sem permissão de excluir vendas'; end if;
 if v_role is distinct from 'master' then
  if not exists(
   select 1 from public.permissoes p
   left join public.usuario_acessos_etapas a
     on a.usuario_id=p.usuario_id and a.empresa_id=p.empresa_id
   where p.usuario_id=p_usuario and p.empresa_id=p_empresa
     and p.setor_id='portal-cliente' and p.nivel='edicao'
     and (a.config #>> '{modulos,portal-cliente}' is null
       or a.config #>> '{modulos,portal-cliente}'='edicao')
     and (a.config #>> '{acoes,clientes.portal.excluir_venda}' is null
       or a.config #>> '{acoes,clientes.portal.excluir_venda}'='edicao')
  ) then raise exception 'Usuário sem permissão de excluir vendas'; end if;
 end if;
 select * into v_venda from public.vendas_obras
  where id=p_venda and empresa_id=p_empresa for update;
 if not found then raise exception 'Venda não localizada nesta empresa'; end if;
 if v_venda.excluida_em is not null then raise exception 'Venda já excluída'; end if;
 if v_venda.status='concluida' then
  raise exception 'Venda concluída exige revisão administrativa antes da exclusão'; end if;

 -- Nada que tenha movimentação de produção, compra ou instalação é cancelado automaticamente.
 if exists(select 1 from public.ordens_producao where venda_obra_id=p_venda and empresa_id=p_empresa)
 or exists(select 1 from public.venda_cotacao_lotes where venda_obra_id=p_venda and empresa_id=p_empresa)
 or exists(select 1 from public.venda_instalacao_itens where venda_obra_id=p_venda and empresa_id=p_empresa)
 then raise exception 'Venda possui produção, cotação ou instalação vinculada. Regularize antes de excluir'; end if;

 -- Contas já pagas ou com alocações exigem correção financeira específica.
 if exists(select 1 from public.financeiro_contas_receber f
   where f.venda_obra_id=p_venda and f.empresa_id=p_empresa
   and (coalesce(f.valor_pago,0) <> 0 or f.status='pago'
    or exists(select 1 from public.financeiro_recebimento_alocacoes a where a.conta_receber_id=f.id)))
 then raise exception 'Há recebimento ou movimentação financeira. Corrija no Financeiro antes de excluir'; end if;
 if exists(select 1 from public.financeiro_contas_receber f
   where f.venda_obra_id=p_venda and f.empresa_id=p_empresa and f.status<>'cancelado'
     and (coalesce(f.orcamento_id,'00000000-0000-0000-0000-000000000000'::uuid) <> v_venda.orcamento_id
       or coalesce(f.observacoes,'') not like 'Pré-lançamento criado pela automação Venda confirmada%'))
 then raise exception 'Há lançamento financeiro manual vinculado. Regularize antes de excluir'; end if;

 -- Apenas o pré-lançamento automático sem recebimento será cancelado, nunca apagado.
 update public.financeiro_contas_receber
 set status='cancelado',updated_at=now(),
     observacoes=concat_ws(E'\n',nullif(observacoes,''),'[Atlas] Cancelada por exclusão auditada de venda incorreta.')
 where empresa_id=p_empresa and venda_obra_id=p_venda and status<>'cancelado';
 get diagnostics v_contas_canceladas = row_count;

 update public.vendas_obras
 set status='cancelada',excluida_em=now(),excluida_por_id=p_usuario,
     excluida_motivo=btrim(p_motivo),updated_at=now()
 where id=p_venda and empresa_id=p_empresa;

 insert into public.venda_exclusoes_auditoria
 (empresa_id,venda_obra_id,cliente_id,numero_venda,status_anterior,valor_venda,
  motivo,usuario_id,usuario_nome,contas_canceladas)
 values (p_empresa,p_venda,v_venda.cliente_id,v_venda.numero,v_venda.status,
  v_venda.valor_venda,btrim(p_motivo),p_usuario,coalesce(v_nome,'Master'),v_contas_canceladas);

 return jsonb_build_object('ok',true,'vendaId',p_venda,'contasCanceladas',v_contas_canceladas);
end;$function$


REVOKE ALL ON FUNCTION public.excluir_venda_incorreta_v1(uuid,uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_venda_incorreta_v1(uuid,uuid,uuid,text)
  TO service_role;
