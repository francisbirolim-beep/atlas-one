# NEXT_TASK.md — Atlas One

## Ultima tarefa concluida
PR #28 "Tipologias dinamicas: nova tipologia funciona em todo o sistema" — mergeado em main. Substituiu listas fixas de tipologia (porta/janela) por busca dinamica na tabela tipologias em: app/kanban/page.tsx, app/orcamento-rapido/page.tsx, app/producao/medicao-final/page.tsx, app/producao/medicao-final/[id]/page.tsx, app/configuracoes/page.tsx. Incluiu botao "Adicionar tipologia" em Configuracoes.

## Tarefa em andamento (INTERROMPIDA, sem commit)
Objetivo: quando um card do Kanban de orcamentos e movido para uma coluna com gera_medicao_final=true (ex.: "Vendido"), criar automaticamente o card correspondente em Medicao Final — hoje isso e 100% manual (ver CURRENT_STATE.md).

O que ficou decidido (plano, ainda nao commitado):
- Editar lib/kanban.ts, funcao moverCard: apos o update de coluna_id, se nao houve erro, chamar (fire-and-forget, com .catch) uma nova funcao criarMedicaoSeNecessario(colunaId, orcamentoId).
- Nova funcao criarMedicaoSeNecessario deve: 1) buscar kanban_colunas.gera_medicao_final da coluna destino; se false, retornar. 2) checar se ja existe medicoes_finais.orcamento_id = orcamentoId; se ja existe, retornar (evitar duplicata). 3) chamar criarMedicaoDoOrcamento(orcamentoId, null) de lib/medicaoFinal.ts (o parametro usuario aceita null).
- Import necessario em lib/kanban.ts: import { criarMedicaoDoOrcamento } from './medicaoFinal'.
- Essa edicao FOI REDIGIDA e testada como string (substituicoes de texto conferidas), mas NUNCA foi de fato aplicada/commitada no GitHub porque a sessao do navegador perdeu a autenticacao no meio do processo. Nao ha nenhum commit parcial — lib/kanban.ts em main esta como estava antes, sem essa mudanca.

## Proximo passo recomendado
1. Reaplicar a edicao acima em lib/kanban.ts (branch nova, ex. feat/medicao-final-auto-vendido).
2. Abrir PR, aguardar build da Vercel (checar "Ready to merge"), mergear.
3. Validar no banco (nao precisa testar na UI): mover manualmente um orcamento de teste para a coluna Vendido via SQL (update orcamentos set coluna_id = '<id da coluna Vendido>' ...) NAO reflete a automacao, pois ela roda no client (lib/kanban.ts), nao via trigger de banco. A validacao real precisa ser feita arrastando um card de verdade no Kanban (app/kanban) e conferindo se apareceu um registro novo em medicoes_finais com esse orcamento_id.
4. Depois de validar, atualizar CURRENT_STATE.md (mover esse item de "NAO IMPLEMENTADO" para "FUNCIONANDO") e IMPLEMENTATIONS.md.

## Arquivos provavelmente envolvidos
- lib/kanban.ts (edicao principal)
- lib/medicaoFinal.ts (so leitura, criarMedicaoDoOrcamento ja existe e nao precisa mudar)
- Nenhuma migration nova e necessaria (kanban_colunas.gera_medicao_final e medicoes_finais.orcamento_id ja existem).

## Riscos e cuidados
- criarMedicaoDoOrcamento faz varias queries (orcamento, cliente, itens) — se chamado toda vez que um card e movido (mesmo entre colunas que nao sao Vendido), isso seria caro. A checagem gera_medicao_final DEVE vir antes de qualquer outra query, para sair cedo na maioria dos casos.
- Cuidado com duplicatas: um card pode ser movido para dentro e para fora de "Vendido" varias vezes (ex.: por engano). A checagem de medicoes_finais.orcamento_id existente evita recriar, mas nao cobre o caso de precisar re-vincular caso a medicao tenha sido excluida manualmente — isso e esperado (cria de novo).
- O historico de tarefas (tabela historico) ja registra a troca de coluna separadamente (registrarHistorico em app/kanban/page.tsx) — nao precisa duplicar esse registro dentro de criarMedicaoSeNecessario.
- Nao mexer em lib/calculos.ts nesta tarefa — e um problema separado, ja documentado em CURRENT_STATE.md (categoria porta/janela de tipologias novas nao esta conectada ao calculo).
