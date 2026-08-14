# Estado atual — correção Kanban

A branch `fix/kanban-iniciar-e-foto-pedido` contém a correção do fluxo de abertura dos cards da primeira coluna do painel de orçamentos.

Estado esperado após merge:
- pedido novo na primeira coluna sempre abre a etapa **Iniciar orçamento**;
- pedido já iniciado abre **Retornar orçamento**;
- não existe mais exceção para o criador entrar direto na edição;
- fotos do item são preservadas e normalizadas ao abrir o card;
- leitura automática da trena não faz parte desta correção.
