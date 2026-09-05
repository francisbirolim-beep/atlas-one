do $$
declare
  t text;
  tabelas text[] := array[
    'historico','assistencias','permissoes','crm_tarefas','crm_interacoes','crm_metas','backups','audit_log','configuracoes_gerais',
    'kanban_colunas','assistencia_colunas','tarefa_colunas','tarefas','eventos','evento_convidados','agente_conversas','agente_mensagens','agente_memorias',
    'producao_itens','producao_colunas','setor_kanban_colunas','setor_kanban_itens','setor_kanban_movimentos','automacoes_orcamento','automacoes_assistencia',
    'agentes_ia','ia_uso_log','setor_instrucoes_versoes','notificacoes','notificacao_preferencias','medicoes_finais','medicao_itens','medicao_pendencias',
    'medicao_fotos','medicao_respostas','medicao_acessos_externos','medicao_revisoes','engenharia_conferencias','compras_nfs','compras_nf_itens','compras_recebimentos',
    'compras_recebimento_itens','compras_recebimento_fotos','produto_fornecedores','estoque_saldos','estoque_movimentos','financeiro_contas_pagar','estoque_locais',
    'estoque_enderecos','estoque_reservas','estoque_transferencias','estoque_transferencia_itens','balcao_caixas','balcao_vendas','balcao_venda_itens','balcao_pagamentos',
    'balcao_caixa_movimentos','financeiro_contas_receber','balcao_pontos_caixa','balcao_venda_eventos','balcao_venda_evento_itens','balcao_orcamentos','financeiro_recebimentos',
    'financeiro_recebimento_alocacoes','cliente_documentos','vendas_obras','venda_obra_revisoes','workflow_automacoes','workflow_execucoes','ordens_producao','pacotes_tecnicos',
    'pacote_tecnico_materiais','estoque_sobras_perfis','pacote_tecnico_barras','pacote_tecnico_cortes','pacote_tecnico_separacoes','pacote_tecnico_compras',
    'catalogo_custos_tecnicos','orcamento_precificacao_componentes','orcamento_item_precificacao','orcamento_item_componentes_overrides','produto_imagens',
    'historico_precos_compra','compras_necessidades','compras_cotacoes','fornecedor_documentos','fornecedor_catalogo_itens','produto_fornecedor_precos_historico','usuario_cadastros_360_permissoes',
    'ai_interacoes','ai_feedback','ai_memorias'
  ];
begin
  foreach t in array tabelas loop
    execute format('alter table public.%I add column if not exists empresa_id uuid references public.empresas(id)', t);
    execute format('alter table public.%I alter column empresa_id set default private.current_empresa_id()', t);
    execute format('update public.%I set empresa_id = (select id from public.empresas where slug = %L) where empresa_id is null', t, 'esquadrifacio');
    execute format('create index if not exists %I on public.%I(empresa_id)', 'idx_' || t || '_empresa_id', t);
  end loop;
end $$;
