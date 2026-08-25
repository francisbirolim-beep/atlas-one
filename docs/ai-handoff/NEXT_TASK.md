# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar busca incremental de clientes da Venda Balcão

PR: `#276`
Branch: `fix/balcao-busca-cliente-incremental`

Objetivo: fazer a seleção de cliente na tela `/balcao` usar o cadastro compartilhado do Atlas de forma rápida e tolerante à digitação real do usuário.

### Implementado

1. busca por nome, CPF/CNPJ, telefone, WhatsApp e cidade;
2. normalização de acentos no servidor (`JOAO` encontra `João`);
3. documentos/telefones pesquisáveis sem pontuação;
4. captura nativa `onInput` + `onCompositionUpdate`;
5. debounce de 70 ms;
6. cancelamento da requisição anterior e proteção contra resposta fora de ordem;
7. spinner pequeno enquanto a lista de clientes está sendo atualizada;
8. busca de produtos da tela principal também usa captura nativa;
9. seleção continua usando o mesmo `clientes.id` do Atlas — sem duplicação de cadastro.

### Validação funcional depois do merge

Em `/balcao`:

- digitar `JU` e confirmar sugestões como Julio/Juliano/Juliane;
- digitar `JOAO` sem acento e confirmar João paulo/João Vitor;
- digitar parte de telefone/WhatsApp e confirmar cliente correspondente;
- clicar em uma sugestão e confirmar que o nome fica selecionado para a venda;
- continuar digitando no campo de produto e confirmar filtro letra por letra.

## Depois desta validação

Próximas evoluções do PDV, mantendo sempre a mesma base do Atlas:

1. completar fluxo de cadastro/estoque necessário para operação de balcão sem duplicação;
2. decidir e implementar administração de pontos de caixa por unidade;
3. definir provedor fiscal e regras para NFC-e/NF-e/cancelamento fiscal;
4. adicionar módulo Fiscal ao menu do balcão apenas quando existir fluxo real funcional;
5. avaliar empacotamento comercial futuro em que clientes possam contratar só o Modo PDV, ocultando módulos do ERP, sem separar o backend.

## W.Vetro

Auditoria completa encerrada e validada. **Não executar novamente a auditoria inteira sem necessidade.**

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
- Branch → PR → build/preview → merge; nunca commit direto em main.
- Venda Balcão e Atlas completo compartilham produtos, clientes, estoque, compras e financeiro.
- Busca operacional deve ser tolerante à ausência de acentos quando possível.
- Não apagar venda, pagamento, movimento ou histórico para efetuar estorno.
- Estoque, caixa e financeiro devem ser movimentados por transação auditável e idempotente.
- W.Vetro é referência; regra técnica Atlas validada sempre tem prioridade.
