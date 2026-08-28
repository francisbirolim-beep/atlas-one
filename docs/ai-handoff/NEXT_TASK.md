# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Cadastros 360 por usuário

Branch: `feat/cadastros-360-permissoes`

Validar no preview:

1. abrir `/cadastros` como Master e confirmar todos os cards, incluindo Clientes;
2. em `/configuracoes/usuarios`, selecionar um funcionário de teste e deixar somente Clientes marcado em Cadastros 360;
3. entrar com esse funcionário e confirmar que `/cadastros` mostra somente Clientes;
4. restaurar as opções do funcionário após o teste, se necessário;
5. conferir o layout da seleção no celular.

Próxima evolução recomendada: aplicar permissões profundas por rota e ação (`ver`, `criar`, `editar`, `excluir`, `aprovar`) sem criar uma segunda base de usuários ou cadastros.


## TAREFA ATUAL — validar filtro do Kanban por período e tipo de data

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
