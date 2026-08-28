# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Compras 360 V1

Branch: `feat/compras-360-v1`

Objetivo: testar o fluxo operacional completo de compra antes do merge.

### Roteiro de validação

Em `/compras`:

1. criar uma necessidade manual para um item ainda não cadastrado;
2. criar outra necessidade vinculada a um produto oficial e conferir a última compra exibida;
3. cadastrar duas cotações de fornecedores diferentes e comparar total, prazo e pagamento;
4. avançar o card por cotação, aprovação, pedido, aguardando entrega e recebido;
5. confirmar que mudar o card para recebido não altera o estoque;
6. usar o recebimento físico da nota fiscal para realizar a entrada oficial no estoque;
7. conferir o layout no desktop e no celular.

### W.Vetro — próxima etapa em PR separado

- manter Atlas como fonte oficial e W.Vetro somente como referência até validação;
- revisar as 93 divergências de unidade e os 785 acessórios ainda ausentes;
- validar tipologias/receitas antes de qualquer promoção para cadastro oficial;
- não sobrescrever automaticamente produto, unidade, custo, preço, margem ou estoque do Atlas.

---

## TAREFA ANTERIOR — validar filtro do Kanban por período e tipo de data

Branch: `feat/kanban-filtro-periodo-datas`

Objetivo: permitir consultar cards por intervalo inclusivo de datas, escolhendo entre a data fixa de entrada no Kanban e a data da última movimentação da coluna.

### Implementado

1. seletor `Data: entrada no Kanban` / `Data: última movimentação`;
2. campos `De` e `Até`, ambos opcionais e inclusivos;
3. correção automática de intervalo invertido;
4. filtro de entrada baseado em `kanban_entrada_em`, com fallback legado para `created_at`;
5. filtro de movimentação baseado em `coluna_atualizada_em`;
6. data de entrada renderizada diretamente no card React;
7. removida a segunda consulta ao Supabase usada apenas para injetar datas no DOM;
8. consulta do Kanban exclui explicitamente registros de balcão sem eliminar registros legados com `modo_entrada` nulo;
9. `OrcamentoRapido` tipado com `kanban_entrada_em`;
10. build completo local aprovado.

### Validação técnica concluída

- PR #281 aberto para `main`;
- Build Validation #643 concluído com sucesso;
- Preview Vercel em estado `READY`;
- diff remoto contém somente os seis arquivos esperados;
- próximo passo: merge manual e confirmação do deploy de produção.

### Validação funcional no preview

Em `/kanban`:

- confirmar que `De` sozinho traz a data inicial e posteriores;
- confirmar que `Até` sozinho traz a data final e anteriores;
- confirmar que `De` + `Até` inclui os dois dias limites;
- alternar para `Data: última movimentação` e confirmar que o conjunto muda conforme `coluna_atualizada_em`;
- conferir o layout em largura de celular;
- confirmar que a linha `📅 Entrada` continua abaixo da descrição e antes do vendedor/valor;
- confirmar que nenhum orçamento/venda de balcão aparece;
- usar `Limpar filtros` e confirmar retorno ao padrão de data de entrada.

## Próximo passo recomendado depois desta validação

Adicionar indicadores/resumo do período filtrado somente se houver necessidade operacional validada, sem misturar novamente entrada e movimentação.

## W.Vetro

Auditoria histórica completa encerrada. **Não executar novamente a auditoria inteira sem necessidade.**

Resumo preservado:
- 1.307 perfis;
- 1.174 acessórios;
- 111 tipologias referência, 109 mapeadas;
- 119 linhas referência;
- 1.529 perfis históricos;
- 1.294 acessórios históricos;
- 14 vidros referência;
- 2.481 produtos consultados;
- 1.287 imagens copiadas.

## Regras invioláveis

- GitHub é a fonte da verdade.
- Branch → PR → build/preview → merge; nunca commit direto em `main`.
- Venda Balcão e Atlas completo compartilham produtos, clientes, estoque, compras e financeiro; tabelas transacionais próprias do PDV podem existir no mesmo banco para isolar fluxos.
- Venda/Orçamento Balcão rápido não alimenta o Kanban; orçamento sob medida/obra alimenta.
- `kanban_entrada_em` é fixa; `coluna_atualizada_em` é movimentação/SLA.
- Busca operacional dos principais cadastros deve seguir o padrão Atlas V1.
- Não inventar custo, preço, margem ou unidade comercial a partir de referência W.Vetro.
- W.Vetro é referência; regra técnica Atlas validada sempre tem prioridade.
