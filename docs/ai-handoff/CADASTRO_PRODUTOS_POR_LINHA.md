# Cadastro — Produtos por Linha

## Escopo desta implementação

A navegação de Cadastro > Produtos passa a priorizar a organização por Linha, sem alterar schema nem recategorizar registros existentes.

### Tela principal do Cadastro

- `Produto pronto` deixa de aparecer como acesso separado na tela principal;
- registros legados `porta_janela_padrao` continuam preservados no banco;
- `Nova categoria` passa para o topo da seção `Produtos e itens`, como ação secundária;
- o acesso `Produto` passa a abrir `/cadastro/produtos/por-linha`.

### Produtos por Linha

Fluxo:
1. escolher a Linha (ex.: Suprema);
2. listar somente os produtos vinculados àquela Linha;
3. permitir busca por código, nome ou descrição;
4. exibir os itens em cards, usando `foto_url` quando existir;
5. manter acesso ao cadastro completo existente para edição/precificação.

No catálogo por Linha, as categorias `produto` e `porta_janela_padrao` são tratadas juntas apenas para navegação. Nenhum registro é recategorizado automaticamente.

## Segurança

- sem migration;
- sem alteração de schema;
- sem update em lote;
- sem inferência de Linha por nome;
- vínculo de Linha continua vindo de `produtos.linha_id`;
- itens sem Linha não são atribuídos automaticamente.
