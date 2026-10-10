revoke execute on function public.finalizar_venda_balcao_sem_caixa(uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) from public, anon;
grant execute on function public.finalizar_venda_balcao_sem_caixa(uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) to authenticated, service_role;

revoke execute on function public.fn_engenharia_liberar_para_producao(uuid,uuid,uuid,text) from public, anon;
grant execute on function public.fn_engenharia_liberar_para_producao(uuid,uuid,uuid,text) to authenticated;

revoke execute on function public.fn_bloquear_liberacao_engenharia_incompleta() from public, anon, authenticated;
revoke execute on function public.fn_gate_medicao_liberar_producao_v1() from public, anon, authenticated;
revoke execute on function public.fn_gates_card_material_v1() from public, anon, authenticated;
revoke execute on function public.fn_instalacao_concluida_v1() from public, anon, authenticated;
revoke execute on function public.fn_orcamento_obra_coluna_orcamento_feito_v1() from public, anon, authenticated;
revoke execute on function public.fn_sync_card_producao_ordens_v1() from public, anon, authenticated;
revoke execute on function public.notificar_convite_evento() from public, anon, authenticated;
revoke execute on function public.notificar_tarefa_atribuida() from public, anon, authenticated;
revoke execute on function public.proteger_metadados_atribuicao_tarefa() from public, anon, authenticated;
revoke execute on function public.registrar_historico_formula_corte() from public, anon, authenticated;
revoke execute on function public.workflow_ordens_producao_trigger_v1() from public, anon, authenticated;
