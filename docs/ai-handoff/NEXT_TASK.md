# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar filtros do catálogo do Orçamento Balcão

Branch: `fix/balcao-filtros-catalogo-v2`

Objetivo: garantir que o catálogo de `/balcao/orcamentos/novo` mantenha a navegação visual por categoria e por Linha, incluindo a nova categoria comercial **Vidro**.

### Implementado

1. `Vidro` adicionado a `CATEGORIAS_PRODUTO_PRINCIPAIS`;
2. ordem esperada da faixa: `Todas | Produto | Acessório | Perfil | Vidro | Produto pronto | PU | Outro`;
3. segundo nível de Linha preservado pelo vínculo `linha_produtos`;
4. base confirmada: 1.174 acessórios em 36 linhas e 1.307 perfis em 53 linhas;
5. busca textual continua combinável com Categoria + Linha;
6. nenhuma referência W.Vetro de vidro foi convertida automaticamente em produto comercial;
7. nenhuma migration e nenhuma alteração de preço/custo/estoque/margem/unidade.

### Validação técnica antes do merge

- confirmar preview Vercel `READY` no HEAD final;
- abrir PR para `main`;
- confirmar Build Validation do GitHub Actions;
- revisar diff final;
- somente então fazer merge e confirmar produção `READY`.

### Validação funcional depois do merge

Em `/balcao/orcamentos/novo`:

- confirmar que os botões de categoria estão visíveis;
- confirmar `Vidro` entre `Perfil` e `Produto pronto`;
- clicar `Acessório` e confirmar que a faixa de Linhas aparece e filtra os acessórios;
- clicar `Perfil` e confirmar que a faixa de Linhas aparece e filtra os perfis;
- escolher uma Linha e depois pesquisar por código/nome/descrição;
- voltar para `Todas` e confirmar que o filtro de Linha é limpo;
- clicar em `Vidro`: enquanto não houver vidro comercial cadastrado, resultado vazio é esperado.

## Próximo passo depois da validação

Definir o cadastro comercial de Vidros separado da referência técnica W.Vetro, incluindo campos mínimos de tipo, cor, espessura/composição, unidade operacional, custo e preço, antes de permitir venda/estoque real de vidro no balcão.

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
- Venda Balcão e Atlas completo compartilham produtos, clientes, estoque, compras e financeiro.
- Busca operacional dos principais cadastros deve seguir o padrão Atlas V1.
- Não inventar custo, preço, margem ou unidade comercial a partir de referência W.Vetro.
- W.Vetro é referência; regra técnica Atlas validada sempre tem prioridade.
