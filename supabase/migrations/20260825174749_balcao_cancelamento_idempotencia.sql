alter table public.balcao_venda_eventos add column if not exists chave_idempotencia uuid;
create unique index if not exists uq_balcao_eventos_idempotencia on public.balcao_venda_eventos(chave_idempotencia) where chave_idempotencia is not null;

create or replace function public.processar_cancelamento_devolucao_balcao(
  p_venda_id uuid,
  p_tipo text,
  p_itens jsonb,
  p_motivo text,
  p_observacoes text,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_reembolsar_caixa boolean,
  p_caixa_id uuid,
  p_chave_idempotencia uuid
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_existente record;
  v_resultado jsonb;
  v_evento_id uuid;
begin
  if p_chave_idempotencia is null then raise exception 'Chave de idempotência obrigatória.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_chave_idempotencia::text,0));
  select e.*,v.status as venda_status into v_existente
    from public.balcao_venda_eventos e join public.balcao_vendas v on v.id=e.venda_id
    where e.chave_idempotencia=p_chave_idempotencia limit 1;
  if v_existente.id is not null then
    return jsonb_build_object(
      'ok',true,'idempotente',true,'eventoId',v_existente.id,'valor',v_existente.valor,
      'reembolsoCaixa',coalesce((v_existente.dados->>'reembolso_caixa')::numeric,0),
      'reembolsoPendente',coalesce((v_existente.dados->>'reembolso_pendente')::numeric,0),
      'statusVenda',v_existente.venda_status
    );
  end if;

  v_resultado:=public.processar_cancelamento_devolucao_balcao(
    p_venda_id,p_tipo,p_itens,p_motivo,p_observacoes,p_usuario_id,p_usuario_nome,p_reembolsar_caixa,p_caixa_id
  );
  v_evento_id:=nullif(v_resultado->>'eventoId','')::uuid;
  if v_evento_id is null then raise exception 'Operação concluída sem evento de auditoria.'; end if;
  update public.balcao_venda_eventos set chave_idempotencia=p_chave_idempotencia where id=v_evento_id;
  return v_resultado || jsonb_build_object('chaveIdempotencia',p_chave_idempotencia);
end;
$$;

revoke all on function public.processar_cancelamento_devolucao_balcao(uuid,text,jsonb,text,text,uuid,text,boolean,uuid,uuid) from public,anon,authenticated;
grant execute on function public.processar_cancelamento_devolucao_balcao(uuid,text,jsonb,text,text,uuid,text,boolean,uuid,uuid) to service_role;
