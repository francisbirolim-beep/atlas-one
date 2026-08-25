# Venda Balcão — busca por evento nativo de input

Correção do comportamento em que a pesquisa só reagia ao pressionar espaço em determinados teclados/navegadores.

- usar `onInput` no campo de pesquisa de produtos;
- usar `onCompositionUpdate` para capturar composição do teclado;
- manter debounce curto e cancelamento de requisição anterior;
- aplicar primeiro em Consulta de preço e validar em produção;
- replicar o mesmo padrão na tela de Venda Balcão após validação visual.
