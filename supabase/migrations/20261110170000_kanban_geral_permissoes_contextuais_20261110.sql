-- Kanban Geral: delegação específica para mover cards; permissão de consulta já existe.
-- Reutiliza a movimentação auditada, sem alterar status operacionais, colunas ou acessos anteriores.
begin;

create or replace function public.mover_card_principal_kanban_obra_coluna_v2(
 p_empresa uuid,p_usuario uuid,p_venda uuid,p_coluna_id text,p_motivo text
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
 v_role text;
 v_config jsonb;
 v_setor text;
 v_colunas jsonb;
 v_destino jsonb;
 v_etapa text;
 v_estado_anterior text;
 v_etapa_anterior text;
 v_coluna_anterior text;
begin
 select lower(role) into v_role from public.usuarios
  where id=p_usuario and empresa_id=p_empresa;
 if v_role is null then raise exception 'Usuário não autorizado nesta empresa'; end if;
 if not exists(select 1 from public.vendas_obras
  where id=p_venda and empresa_id=p_empresa
    and lower(coalesce(status,'')) not in ('cancelada','cancelado'))
 then raise exception 'Venda não encontrada ou cancelada nesta empresa'; end if;
 if p_coluna_id is null or p_coluna_id !~ '^[a-zA-Z0-9_-]{1,100}$'
 then raise exception 'Identificador da coluna inválido'; end if;
 if char_length(btrim(coalesce(p_motivo,''))) not between 8 and 1000
 then raise exception 'Motivo de movimentação inválido'; end if;

 if v_role <> 'master' then
  select config into v_config from public.usuario_acessos_etapas
   where empresa_id=p_empresa and usuario_id=p_usuario;
  -- Autorização independente e explícita do Kanban Geral, sem abrir acesso a outros módulos.
  -- A autorização legada do Kanban da obra continua funcionando sem mudança.
  if not (
    coalesce(v_config #>> '{acoes,painel_visao_geral_projetos}' in ('consulta','edicao'),false)
    and coalesce(v_config #>> '{acoes,painel_visao_geral_projetos_mover}' = 'edicao',false)
  ) then
   select nivel into v_setor from public.permissoes
    where empresa_id=p_empresa and usuario_id=p_usuario and setor_id='portal-cliente';
   if v_setor is distinct from 'edicao'
    or v_config #>> '{modulos,kanban-obra}' is distinct from 'edicao'
    or v_config #>> '{acoes,clientes.kanban_obra.mover}' is distinct from 'edicao'
   then raise exception 'Movimentação não autorizada pelo Master'; end if;
  end if;
 end if;

 select colunas into v_colunas from public.visao_geral_configuracoes
  where empresa_id=p_empresa;
 -- Configuração padrão usada quando a empresa ainda não personalizou o quadro.
 if v_colunas is null then
  v_colunas:='[
   {"id":"vendido","criterios":["vendido"]},
   {"id":"validacao_projeto","criterios":["conferir_projeto"]},
   {"id":"separacao","criterios":["separacao_materiais","compras_liberacao"]},
   {"id":"compras","criterios":["compras"]},
   {"id":"aguardando","criterios":["aguardando_materiais"]},
   {"id":"medicao","criterios":["medicao_final"]},
   {"id":"producao","criterios":["aguardando_producao","producao"]},
   {"id":"instalacao","criterios":["aguardando_instalacao","instalacao"]},
   {"id":"finalizado","criterios":["finalizado"]}
  ]'::jsonb;
 end if;
 select item into v_destino
 from jsonb_array_elements(v_colunas) as t(item)
 where item->>'id'=p_coluna_id;
 if v_destino is null then raise exception 'Coluna de destino não cadastrada neste Kanban'; end if;

 select estado,etapa_visual,coluna_visual_id
  into v_estado_anterior,v_etapa_anterior,v_coluna_anterior
  from public.visao_geral_cards_controle
  where empresa_id=p_empresa and venda_id=p_venda for update;
 if v_estado_anterior='oculto'
 then raise exception 'Card retirado do painel; restaure antes de mover'; end if;
 if v_estado_anterior='finalizado' then v_etapa_anterior:='finalizado'; end if;

 -- Etapas novas podem não possuir critério operacional; o valor legado
 -- é mantido apenas para compatibilidade, nunca usado para disparar ações.
 v_etapa:=coalesce(v_destino->'criterios'->>0,v_etapa_anterior,'vendido');
 if v_etapa not in
  ('vendido','conferir_projeto','separacao_materiais','compras_liberacao',
   'compras','aguardando_materiais','medicao_final','aguardando_producao',
   'producao','aguardando_instalacao','instalacao','finalizado')
 then raise exception 'Vínculo operacional de coluna inválido'; end if;
 if v_estado_anterior='manual' and v_coluna_anterior=p_coluna_id
 then return jsonb_build_object('ok',true,'vendaId',p_venda,'colunaId',p_coluna_id,'semMudanca',true); end if;

 insert into public.visao_geral_cards_controle
  (empresa_id,venda_id,estado,etapa_visual,coluna_visual_id,motivo,atualizado_por_id)
 values(p_empresa,p_venda,'manual',v_etapa,p_coluna_id,btrim(p_motivo),p_usuario)
 on conflict(empresa_id,venda_id) do update
 set estado='manual',etapa_visual=excluded.etapa_visual,
     coluna_visual_id=excluded.coluna_visual_id,
     motivo=excluded.motivo,atualizado_por_id=excluded.atualizado_por_id,
     updated_at=now();

 insert into public.visao_geral_cards_historico
 (empresa_id,venda_id,estado_anterior,estado_novo,
  etapa_anterior,etapa_nova,coluna_anterior,coluna_nova,motivo,usuario_id)
 values(p_empresa,p_venda,v_estado_anterior,'manual',
  v_etapa_anterior,v_etapa,v_coluna_anterior,p_coluna_id,btrim(p_motivo),p_usuario);

 return jsonb_build_object('ok',true,'vendaId',p_venda,'colunaId',p_coluna_id,'etapa',v_etapa);
end;$$;

revoke all on function public.mover_card_principal_kanban_obra_coluna_v2(uuid,uuid,uuid,text,text)
 from public,anon,authenticated;
grant execute on function public.mover_card_principal_kanban_obra_coluna_v2(uuid,uuid,uuid,text,text)
 to service_role;

commit;
