-- Posição visual manual do card principal por venda, sem alterar operações.
-- Reutiliza controle e histórico existentes com segurança e isolamento por empresa.
begin;

alter table public.visao_geral_cards_controle
 drop constraint if exists visao_geral_cards_controle_estado_check;
alter table public.visao_geral_cards_controle
 add constraint visao_geral_cards_controle_estado_check
 check (estado in ('finalizado','oculto','manual'));

alter table public.visao_geral_cards_controle
 add column if not exists etapa_visual text;
alter table public.visao_geral_cards_controle
 add constraint visao_geral_cards_controle_etapa_visual_check
 check (
   (etapa_visual is null or etapa_visual in
    ('vendido','conferir_projeto','separacao_materiais','compras_liberacao',
     'compras','aguardando_materiais','medicao_final','aguardando_producao',
     'producao','aguardando_instalacao','instalacao','finalizado'))
   and (estado <> 'manual' or etapa_visual is not null)
 );

alter table public.visao_geral_cards_historico
 add column if not exists etapa_anterior text;
alter table public.visao_geral_cards_historico
 add column if not exists etapa_nova text;

-- Serviço de alteração somente do espelho visual; o banco valida a delegação
-- além da verificação de acesso feita na API.
create or replace function public.mover_card_principal_kanban_obra_v1(
 p_empresa uuid, p_usuario uuid, p_venda uuid, p_etapa text, p_motivo text
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
 v_role text;
 v_config jsonb;
 v_setor text;
 v_estado_anterior text;
 v_etapa_anterior text;
begin
 select lower(role) into v_role from public.usuarios
  where id=p_usuario and empresa_id=p_empresa;
 if v_role is null then raise exception 'Usuário não autorizado na empresa'; end if;
 if not exists(select 1 from public.vendas_obras
  where id=p_venda and empresa_id=p_empresa
    and lower(coalesce(status,'')) not in ('cancelada','cancelado'))
 then raise exception 'Venda não encontrada ou cancelada nesta empresa'; end if;

 if p_etapa is null or p_etapa not in
  ('vendido','conferir_projeto','separacao_materiais','compras_liberacao',
   'compras','aguardando_materiais','medicao_final','aguardando_producao',
   'producao','aguardando_instalacao','instalacao','finalizado')
 then raise exception 'Etapa visual inválida'; end if;
 if char_length(btrim(coalesce(p_motivo,''))) not between 8 and 1000
 then raise exception 'Motivo de movimentação inválido'; end if;

 if v_role <> 'master' then
  select config into v_config from public.usuario_acessos_etapas
   where empresa_id=p_empresa and usuario_id=p_usuario;
  select nivel into v_setor from public.permissoes
   where empresa_id=p_empresa and usuario_id=p_usuario and setor_id='portal-cliente';
  if v_setor is distinct from 'edicao'
   or v_config #>> '{modulos,kanban-obra}' is distinct from 'edicao'
   or v_config #>> '{acoes,clientes.kanban_obra.mover}' is distinct from 'edicao'
  then raise exception 'Movimentação não autorizada pelo Master'; end if;
 end if;

 select estado,etapa_visual into v_estado_anterior,v_etapa_anterior
 from public.visao_geral_cards_controle
 where empresa_id=p_empresa and venda_id=p_venda for update;

 if v_estado_anterior='oculto'
 then raise exception 'Card retirado do painel; restaure antes de mover'; end if;
 if v_estado_anterior='finalizado' then v_etapa_anterior='finalizado'; end if;

 insert into public.visao_geral_cards_controle
 (empresa_id,venda_id,estado,etapa_visual,motivo,atualizado_por_id)
 values(p_empresa,p_venda,'manual',p_etapa,btrim(p_motivo),p_usuario)
 on conflict(empresa_id,venda_id) do update
 set estado='manual',etapa_visual=excluded.etapa_visual,
     motivo=excluded.motivo,atualizado_por_id=excluded.atualizado_por_id,updated_at=now();

 insert into public.visao_geral_cards_historico
 (empresa_id,venda_id,estado_anterior,estado_novo,
  etapa_anterior,etapa_nova,motivo,usuario_id)
 values(p_empresa,p_venda,v_estado_anterior,'manual',
  v_etapa_anterior,p_etapa,btrim(p_motivo),p_usuario);

 return jsonb_build_object('ok',true,'vendaId',p_venda,'etapa',p_etapa);
end;$$;

revoke all on function public.mover_card_principal_kanban_obra_v1(uuid,uuid,uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.mover_card_principal_kanban_obra_v1(uuid,uuid,uuid,text,text) to service_role;
commit;
