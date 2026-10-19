-- Exclusão lógica e atômica de uma solicitação inteira, com preservação da auditoria.
-- Nenhum item comprado, carrinho ou movimento de estoque é apagado.
begin;
create or replace function public.cancelar_solicitacao_compras_v1(
 p_empresa uuid,p_usuario uuid,p_solicitacao uuid,p_motivo text,p_editar_todos boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_sol record;v_pendentes integer;v_cancelados integer;v_motivo text;
begin
 if not exists(select 1 from public.usuarios u where u.id=p_usuario and u.empresa_id=p_empresa)
 then raise exception 'Usuário não pertence à empresa';end if;
 v_motivo:=left(btrim(coalesce(p_motivo,'')),250);
 if length(v_motivo)<3 then raise exception 'Informe o motivo do cancelamento';end if;
 select s.id,s.solicitante_id,s.status into v_sol
 from public.compras_solicitacoes s where s.id=p_solicitacao and s.empresa_id=p_empresa for update;
 if not found then raise exception 'Pedido não encontrado';end if;
 if not p_editar_todos and v_sol.solicitante_id<>p_usuario then
 raise exception 'Você só pode alterar seus próprios pedidos';end if;
 -- Usar trigger de auditoria existente por item. Compras já encaminhadas ficam
 -- pendentes de revisão, nunca estornadas automaticamente.
 update public.compras_solicitacao_itens i set
  status=case when exists(select 1 from public.compras_carrinho_itens ci
    where ci.empresa_id=p_empresa and ci.item_id=i.id)
    then 'cancelamento_solicitado' else 'cancelado' end,
  motivo_cancelamento=v_motivo,
  cancelamento_solicitado_em=case when exists(select 1 from public.compras_carrinho_itens ci
    where ci.empresa_id=p_empresa and ci.item_id=i.id) then now() else null end,
  atualizado_por_id=p_usuario,updated_at=now()
 where i.solicitacao_id=p_solicitacao and i.empresa_id=p_empresa and i.status='ativo';
 select count(*) filter(where status='cancelamento_solicitado'),count(*) filter(where status='cancelado')
 into v_pendentes,v_cancelados from public.compras_solicitacao_itens
 where empresa_id=p_empresa and solicitacao_id=p_solicitacao;
 if not exists(select 1 from public.compras_solicitacao_itens
   where empresa_id=p_empresa and solicitacao_id=p_solicitacao and status<>'cancelado')
 and v_sol.status in ('aguardando_validacao','em_cotacao','aguardando_minimo') then
  update public.compras_solicitacoes set status='cancelado',atualizado_por_id=p_usuario,updated_at=now()
   where empresa_id=p_empresa and id=p_solicitacao;
 end if;
 return jsonb_build_object('ok',true,'historicoPreservado',true,
 'cancelados',v_cancelados,'pendentesRevisao',v_pendentes,
 'aviso',case when v_pendentes>0 then
 'Há materiais com carrinho ou compra: a exclusão foi solicitada ao comprador. Nenhuma entrega ou estoque foi desfeito.'
 else 'Pedido excluído logicamente com histórico preservado.' end);
end;$$;
revoke all on function public.cancelar_solicitacao_compras_v1(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.cancelar_solicitacao_compras_v1(uuid,uuid,uuid,text,boolean) to service_role;
commit;