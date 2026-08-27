# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Preview do PR #280

Branch: `feat/cliente-360-obras-financeiro-v1`
PR: #280 — draft. **Não fazer merge ainda.**

O objetivo agora é testar o fluxo real no Preview antes de continuar expandindo.

## 0. Novo Orçamento — validar primeiro
1. Abrir `/orcamento/novo`.
2. Confirmar os três cards no topo: `Orçamento Obra`, `Novo Orçamento Sob Medida`, `Venda Balcão`.
3. Em `Orçamento Obra`, deixar `Categoria: Todas` e `Linha: Todas` e confirmar que o catálogo mostra as 122 tipologias ativas.
4. Conferir categorias além de Porta/Janela: Painéis/Ripados, Fachadas/Pele de Vidro, ACM, Guarda-corpos/Corrimãos, Portões/Grades, Vidros, Boxes, Espelhos, Coberturas/Clarabóias, Módulos Fixos, Contramarcos/Arremates e Tela Mosquiteira.
5. Pesquisar por texto e confirmar filtro em tempo real.
6. Filtrar por categoria e por linha separadamente.
7. Selecionar uma tipologia e continuar para o formulário.
8. Testar `Novo Orçamento Sob Medida` abrindo diretamente o formulário.
9. Testar `Venda Balcão` e confirmar que segue fora do Kanban de obra.

## Checklist de validação manual

### 1. Precificação do orçamento
1. Abrir `/orcamento/precificacao`.
2. Escolher um orçamento real com itens estruturados e tipologias cadastradas.
3. Gerar a base de precificação.
4. Conferir Perfis, Acessórios, Vidros e pendências.
5. Conferir plano de barras e aproveitamento.
6. Alterar margem geral.
7. Alterar margem somente de um item e confirmar que os demais herdam a geral.
8. Ativar/desativar cobrança de sobra geral e individual.
9. Confirmar que sobra cobrada entra a custo, sem margem.
10. Alterar custo de um componente só neste orçamento.
11. Testar `Salvar no catálogo` e confirmar reaproveitamento em nova geração.
12. Incluir custo extra (ex.: instalação/frete) e conferir preço final.

### 2. Alteração de componente / Tipologia
1. Em Precificação, trocar um perfil/acessório somente neste orçamento.
2. Regerar e confirmar que a tipologia mestre não mudou.
3. Como master, testar alteração definitiva em uma tipologia de teste.
4. Abrir `/engenharia/historico-tipologias`.
5. Confirmar nova versão.
6. Restaurar uma versão anterior e confirmar que nasce outra versão, sem apagar histórico.
7. Duplicar uma tipologia e confirmar que a original permanece intacta.

### 3. Projeto conferido → Materiais
1. Confirmar uma venda controlada.
2. Conferir Financeiro + Conferir Projeto e nenhum downstream precoce.
3. Mover para `Projeto conferido`.
4. Confirmar Medição Final + Perfis + Acessórios + Outros.
5. Confirmar que um pacote técnico é gerado/está disponível para a obra.
6. Vidros ainda não devem estar liberados antes da Medição aprovada.

### 4. Materiais / Estoque da Obra
1. Abrir Obra → `Materiais / Estoque`.
2. Conferir Necessidade técnica.
3. Conferir Plano de barras.
4. Separar uma barra inteira disponível.
5. Reservar um retalho/sobra compatível.
6. Recalcular e conferir redução da compra.
7. Desfazer uma separação e confirmar retorno da disponibilidade.
8. Ajustar quantidade final de compra com justificativa.
9. Incluir/remover material manual e conferir histórico/motivo.
10. Marcar pacote conferido somente após revisão.

### 5. Medição / Vidros / Produção
1. Aprovar Medição Final.
2. Confirmar Vidros + MEE.
3. Conferir ordens de Produção vinculadas.
4. Confirmar que esquadria continua bloqueada enquanto Perfis/Acessórios/Outros não estiverem `Liberado`.
5. Liberar os três setores de materiais.
6. Confirmar que Produção é liberada somente com Medição aprovada.
7. Avançar ordens por `Em produção → Conferência → Concluída`.
8. Confirmar que o card de Produção acompanha as ordens e rejeita movimento manual incompatível.

### 6. Instalação
1. Com todas as ordens concluídas, deixar Vidros ainda não liberados e confirmar que Instalação não nasce.
2. Mover Vidros para `Liberado`.
3. Confirmar criação/liberação da Instalação.
4. Validar `Agendada → Em instalação → Concluída`.
5. Confirmar fechamento da Obra ao concluir Instalação.

### 7. Cliente 360
1. Abrir Cliente → Central 360 → Andamento.
2. Conferir que os estados são os mesmos dos setores.
3. Conferir `Bloqueio atual`.
4. Confirmar que não há status paralelo/duplicado.

## Pontos a observar durante o teste

- fórmula não validada deve gerar pendência, nunca material inventado;
- tamanho de barra deve usar o cadastro operacional normalizado;
- compra deve refletir estoque/separações, não apenas necessidade bruta;
- comprado ≠ consumido;
- reprocessamento não deve duplicar cards/tarefas/notificações/ordens;
- alterações pós-venda relevantes exigem justificativa e histórico;
- Balcão rápido continua fora do workflow de obra.

## Próximas implementações após validação

- completar custos `Previsto → Otimizado → Comprado → Realizado` por obra/item/categoria;
- ligar NF/Compras ao custo comprado da obra;
- ligar consumo de estoque, perdas, devoluções e sobras ao custo realizado;
- dashboard de margem realizada no Cliente 360/Obra;
- interface completa de revisão pós-venda e seus ajustes financeiros;
- definir responsáveis dos demais setores no Motor de Automações.

## Regras invioláveis

- não mergear PR #280 antes da aprovação do usuário;
- não criar status duplicado para Cliente 360;
- não liberar Vidros antes da Medição aprovada;
- não liberar Produção sem Medição + Perfis/Acessórios/Outros liberados;
- não criar Instalação sem Produção concluída + Vidros liberados;
- não inventar fórmula/material pendente;
- restauração de tipologia nunca apaga histórico;
- sobra cobrada fica sem margem;
- GitHub continua fonte da verdade.
