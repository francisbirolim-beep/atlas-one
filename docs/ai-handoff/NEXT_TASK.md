# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Cliente 360 + Motor de Automações

Branch: `feat/cliente-360-obras-financeiro-v1`
PR: #280 — draft. **Não fazer merge ainda.**

Referência detalhada: `docs/ai-handoff/CLIENTE360_FLUXO_VENDA.md`.

## Motor de workflow implementado

Rota master: `/configuracoes/automacoes-fluxo`.

Cada automação pode configurar:
- gatilho/evento;
- ação;
- setor e coluna de destino;
- responsável;
- criar ou não tarefa;
- prazo e prioridade;
- avisar responsável;
- usuários adicionais em `Notificar também`;
- mensagem;
- ordem;
- evitar duplicidade;
- ativo/inativo.

O motor usa `workflow_automacoes` + `workflow_execucoes` e reaproveita `tarefas`/`notificacoes` existentes.

Regras padrão já cadastradas:
- Venda confirmada → Financeiro: ativa, Gabrielle responsável, tarefa + aviso;
- Venda confirmada → Conferir Projeto: ativa;
- Projeto conferido → Medição Final: ativa;
- Projeto conferido → Perfis: ativa;
- Projeto conferido → Acessórios: ativa;
- Projeto conferido → Outros: ativa;
- Medição aprovada → Vidros: ativa;
- Medição aprovada → MEE: ativa;
- Materiais liberados → Produção: inativa;
- Produção concluída → Instalação: inativa.

## Fluxo que deve ser preservado

### Arrastar para Vendido
- abre `/vendas/confirmar`;
- NÃO persiste em `Vendido` antes da confirmação.

### Venda confirmada
- snapshot em `vendas_obras`;
- conta real em `financeiro_contas_receber` se a regra Financeiro estiver ativa;
- dispara `venda_confirmada`;
- regras padrão criam somente Financeiro + Conferir Projeto;
- só então `status='vendido'`.

### Projeto conferido
Dispara `projeto_conferido` e, pelas regras ativas:
- Medição Final;
- Perfis;
- Acessórios;
- Outros;
- Vidros ainda não.

### Medição Final aprovada
Dispara `medicao_aprovada` e, pelas regras ativas:
- Vidros;
- MEE/Engenharia técnica pós-medição.

## Validações automáticas concluídas

Venda confirmada, com `ROLLBACK`:
- venda = 1;
- conta a receber = 1;
- Financeiro = 1;
- Conferir Projeto = 1;
- tarefa Gabrielle = 1;
- notificação Gabrielle = 1;
- workflow execuções = 2;
- downstream = 0.

Projeto conferido:
- Medição = 1;
- Perfis = 1;
- Acessórios = 1;
- Outros = 1;
- Vidros = 0.

Medição aprovada:
- Vidros = 1;
- MEE = 1;
- cenário completo = 8 execuções (2 venda + 4 projeto + 2 medição).

Nenhum dado temporário ficou no banco.

## Segurança já validada

- configuração do workflow: escrita somente master;
- `fn_iniciar_fluxo_venda_v2` e `fn_concluir_conferencia_projeto_v1` continuam executáveis por usuário autenticado;
- helpers `fn_workflow_disparar_evento_v1`, `fn_workflow_executar_automacao_v1`, `fn_workflow_renderizar_v1` e `fn_workflow_coluna_tarefa_v1` NÃO são executáveis diretamente por authenticated/anon;
- advisories restantes são legados de outras áreas e não devem ampliar o escopo deste PR.

## Migrations novas do motor

- `20260826232740_workflow_automacoes_responsaveis_notificacoes_v1.sql`;
- `20260826233029_workflow_evitar_notificacao_duplicada_v1.sql`;
- `20260826233648_workflow_restringir_funcoes_internas_v1.sql`.

## Validação manual no Preview antes do merge

1. Abrir `/configuracoes/automacoes-fluxo` como master.
2. Conferir as regras agrupadas por gatilho.
3. Abrir `Venda confirmada → Financeiro` e confirmar Gabrielle como responsável, criação de tarefa e aviso.
4. Testar edição de responsável, `Notificar também`, prazo, prioridade e mensagem sem ativar regras de Produção/Instalação.
5. Confirmar uma venda controlada.
6. Conferir: Financeiro + Conferir Projeto e tarefa/sino do responsável; nenhum downstream.
7. Mover para Projeto conferido e conferir Medição + Perfis + Acessórios + Outros.
8. Aprovar Medição Final e conferir Vidros + MEE.
9. Abrir Cliente 360 → Andamento e conferir os mesmos estados.
10. Confirmar que reprocessamento não duplica cards, tarefas ou notificações.
11. Somente após aprovação do usuário considerar merge.

## Caso legado #60

O orçamento #60 continua sem venda real/conta real confirmada. Não regularizar automaticamente. Se for uma venda válida, usar a confirmação consciente pelo fluxo novo.

## Próximas definições funcionais

- quem será responsável por Conferir Projeto;
- responsável por Medição Final;
- responsável por Perfis, Acessórios, Outros e Vidros;
- responsável pelo MEE;
- gate exato de Produção e possibilidade de produção parcial;
- gate/agendamento de Instalação;
- reabertura após revisão da venda/projeto;
- custos `Previsto → Otimizado → Comprado → Realizado`.

## Regras invioláveis

- GitHub é fonte da verdade.
- Branch → PR → build/preview → merge manual; nunca commit direto em `main`.
- Workflow é configurável, auditável e idempotente.
- Usuário responsável e usuários notificados são conceitos separados.
- Não criar um segundo sistema de tarefas/notificações.
- Cliente 360 consolida registros reais; não duplicar status.
- Venda confirmada não libera downstream completo.
- Vidro nunca nasce antes da Medição Final aprovada.
- Produção e Instalação permanecem inativas até gates definidos.
- Venda/Orçamento Balcão rápido não entra no workflow de obra.
