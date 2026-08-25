# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Modo Venda Balcão integrado ao Atlas

Branch: `feat/balcao-modo-integrado-atlas`

Objetivo aprovado pelo usuário: manter **um único Atlas One** e tratar a Venda Balcão como um ambiente operacional próprio dentro dele.

### Implementado nesta branch

1. `BalcaoShell` identificado como `Modo Venda Balcão`;
2. botão desktop `Voltar ao Atlas` → `/`;
3. botão `Atlas` no menu móvel;
4. menu operacional do balcão continua independente e compacto;
5. seção `Gestão compartilhada` aponta para as telas existentes do mesmo Atlas:
   - Clientes `/clientes`;
   - Produtos / Cadastros `/cadastros`;
   - Estoque `/estoque`;
   - Compras / NF `/compras`;
6. não foi criado segundo cadastro, segundo estoque ou segundo banco.

### Gates antes do merge

- Build Validation verde no HEAD final;
- preview Vercel `READY`;
- PR mergeable;
- validar visualmente `/balcao` no desktop e mobile;
- confirmar que `Voltar ao Atlas` retorna ao shell completo;
- confirmar que os links da gestão compartilhada abrem os módulos corretos do Atlas.

## Depois do merge

Próximas evoluções do PDV, mantendo sempre a mesma base do Atlas:

1. decidir e implementar administração de pontos de caixa por unidade;
2. completar fluxo de estoque/cadastro necessário para operação de balcão sem duplicação;
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
- Não apagar venda, pagamento, movimento ou histórico para efetuar estorno.
- Estoque, caixa e financeiro devem ser movimentados por transação auditável e idempotente.
- W.Vetro é referência; regra técnica Atlas validada sempre tem prioridade.
