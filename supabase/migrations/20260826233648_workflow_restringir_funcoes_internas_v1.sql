-- O browser configura workflow_automacoes via RLS master, mas não pode disparar o motor interno diretamente.
-- Os eventos de negócio (Confirmar venda, Projeto conferido e triggers da Medição) executam estas helpers como owner.

revoke execute on function public.fn_workflow_renderizar_v1(text, uuid, text) from public, anon, authenticated;
revoke execute on function public.fn_workflow_executar_automacao_v1(uuid, uuid, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.fn_workflow_disparar_evento_v1(text, uuid, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.fn_workflow_coluna_tarefa_v1(uuid) from public, anon, authenticated;