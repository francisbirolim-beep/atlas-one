do $$
declare v_count integer;
begin
  select count(*) into v_count
  from information_schema.columns
  where table_schema='public'
    and column_name='empresa_id'
    and table_name in (
      'produto_imagens','historico','notificacoes','tarefa_colunas',
      'workflow_automacoes','producao_colunas','automacoes_orcamento',
      'setor_kanban_movimentos','workflow_execucoes','agentes_ia',
      'automacoes_assistencia','crm_interacoes','crm_metas','notificacao_preferencias'
    )
    and is_nullable <> 'NO';
  if v_count <> 0 then
    raise exception 'P0 regression: % colunas tenant voltaram a aceitar NULL',v_count;
  end if;
  raise notice 'P0_TENANT_NOT_NULL_NONEMPTY_OK';
end $$;
