# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar e publicar Busca Padrão Atlas V1

Branch: `feat/busca-atlas-unificada-v1`

Objetivo: validar a padronização das pesquisas dos principais cadastros e fluxos operacionais sem alterar regras de negócio existentes.

### Validação técnica antes do merge

1. confirmar que a branch continua baseada na `main` atual, sem commits pendentes para rebase;
2. confirmar preview Vercel `READY` no HEAD final;
3. abrir PR para `main`;
4. executar/confirmar Build Validation do GitHub Actions no HEAD da PR;
5. revisar que nenhuma migration foi criada e que os fluxos transacionais existentes permanecem intactos;
6. somente depois fazer merge e confirmar deployment de produção `READY`.

### Validação funcional depois do merge

#### Venda Balcão `/balcao`
- pesquisar `JOAO` e localizar clientes cadastrados como `João`;
- pesquisar cliente por telefone/CPF/CNPJ e por campos ampliados da API;
- pesquisar produto com várias palavras, ex.: `SUPREMA ROLDANA`;
- selecionar produto/cliente e confirmar que venda, estoque e caixa continuam com o comportamento atual.

#### Orçamento Balcão `/orcamento/balcao/novo`
- escolher Categoria e confirmar que a lista de Linhas é reduzida;
- escolher Linha e pesquisar produto dentro desse recorte;
- testar consulta como `SUPREMA ROLDANA` / código / descrição;
- pesquisar cliente por nome, apelido, CPF/CNPJ, telefone, cidade ou bairro;
- selecionar cliente existente, gerar orçamento e confirmar que não é criado cliente duplicado.

#### Clientes `/clientes`
- testar pesquisa geral por nome, apelido, CPF/CNPJ, telefone, cidade, bairro e endereço;
- combinar pesquisa geral com filtros de cidade/bairro/documento/telefone/apelido.

#### Assistência `/assistencia`
- localizar cliente por apelido, bairro, telefone ou CPF/CNPJ;
- selecionar e confirmar preenchimento de telefone/cidade/endereço/bairro;
- salvar chamado e confirmar vínculo ao mesmo cliente.

#### Produtos/Cadastros
- testar código, nome, descrição, linha, categoria, fornecedor e demais campos disponíveis;
- confirmar filtros de Categoria/Linha em Produtos e Precificação;
- confirmar pesquisa de Linhas/Produtos por Linha sem perder vínculos existentes.

#### Estoque
- `/estoque`: pesquisar produto/código/unidade/local/endereço;
- `/estoque/enderecar`: pesquisar produto, loja/local e endereço;
- `/estoque/transferencias`: pesquisar produto na origem e depois pesquisar histórico por nº/status/origem/destino/produto.

#### Compras
- `/compras/notas`: pesquisar NF, fornecedor, CNPJ ou arquivo;
- `/compras/vinculos`: pesquisar item pendente e usar a pesquisa própria do catálogo para selecionar o produto Atlas correto antes do vínculo.

## Depois desta validação

Próximas evoluções, sem misturar com esta PR:

1. revisar telas administrativas/secundárias que ainda possuam busca local antiga e migrá-las gradualmente para `correspondeBuscaAtlas`;
2. implementar administração dos pontos de caixa por unidade;
3. avaliar transferência física opcional antes da retirada de venda reservada;
4. definir provedor fiscal e regras para NFC-e/NF-e/cancelamento fiscal;
5. investigar separadamente as imagens/croquis de tipologias do W.Vetro, sem rerodar a auditoria histórica completa.

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
- Cliente selecionado deve manter o mesmo `clientes.id`; não criar cadastro paralelo.
- Busca operacional dos principais cadastros deve seguir o padrão Atlas V1.
- Não apagar venda, pagamento, movimento ou histórico para efetuar estorno.
- Estoque, caixa e financeiro devem ser movimentados por transação auditável e idempotente.
- W.Vetro é referência; regra técnica Atlas validada sempre tem prioridade.
