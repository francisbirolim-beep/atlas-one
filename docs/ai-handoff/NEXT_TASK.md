# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Balcão fora do Kanban + data fixa de entrada

Branch: `fix/balcao-fora-kanban`

Objetivo: manter Venda/Orçamento Balcão fora do Kanban de obras e registrar/exibir uma data fixa para quando cada card entra no Kanban.

### Implementado

1. criado `balcao_orcamentos` como tabela transacional própria para o orçamento rápido do PDV, mantendo os mesmos clientes/produtos/cadastros mestres do Atlas;
2. `lib/orcamentoBalcao.ts` passou a salvar em `balcao_orcamentos`, não em `orcamentos`;
3. `/api/balcao/orcamentos` passou a consultar `balcao_orcamentos`;
4. registros de balcão existentes foram migrados da fonte do Kanban para a tabela própria e removidos de `orcamentos`;
5. criada `orcamentos.kanban_entrada_em` como data fixa de entrada no Kanban;
6. trigger preenche `kanban_entrada_em` automaticamente para todo registro não-balcão sem alterar essa data quando o card muda de coluna;
7. `coluna_atualizada_em` continua separada e representa a última movimentação de coluna/SLA;
8. `/kanban` exibe `📅 Entrada: DD/MM/AAAA` dentro do card, na posição combinada abaixo da descrição da esquadria e antes dos demais dados;
9. o campo de calendário do painel é identificado como filtro da data de entrada no Kanban;
10. banco validado: 49 cards de Kanban, 49 com data de entrada preenchida e 0 registros de balcão na fonte `orcamentos`.

### Migrations aplicadas e versionadas

- `20260826135831_kanban_data_entrada_v1.sql`;
- `20260826140437_balcao_orcamentos_separado_v1.sql`;
- `20260826140909_kanban_data_entrada_search_path_v1.sql`.

### Validação técnica antes do merge

- abrir PR para `main`;
- confirmar Build Validation / TypeScript;
- confirmar Preview Vercel `READY`;
- revisar o diff final;
- somente então fazer merge manual e confirmar produção `READY`.

### Validação funcional depois do build

Em `/kanban`:

- confirmar a data visível dentro do card na posição combinada;
- arrastar um card para outra coluna e confirmar que a data `Entrada` não muda;
- confirmar que o histórico/SLA continua usando a movimentação da coluna separadamente;
- usar o calendário e confirmar o filtro pelo dia de entrada;
- conferir que cards antigos continuam aparecendo com a data preenchida pelo backfill.

Em `/balcao/orcamentos/novo`:

- criar um orçamento rápido de balcão;
- confirmar que ele aparece em `/balcao/orcamentos`;
- confirmar que ele não aparece em `/kanban`.

No fluxo sob medida:

- criar/solicitar um orçamento sob medida pelo fluxo normal do Atlas;
- confirmar que esse fluxo continua entrando no Kanban normalmente e recebe `kanban_entrada_em`.

## Próximo passo depois desta validação

Evoluir os filtros do Kanban para intervalo de datas (`De` / `Até`) e, se necessário, permitir escolher entre **data de entrada** e **data da última movimentação**, preservando as duas informações separadas.

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
