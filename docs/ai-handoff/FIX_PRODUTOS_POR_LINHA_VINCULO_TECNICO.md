# Correção — Produtos por Linha usando vínculo técnico

## Problema observado

Após a PR #178, a tela `Cadastro > Produto > Produtos por Linha` exibia linhas como `L. SUPREMA (0)` mesmo quando havia vínculos técnicos no Atlas.

## Causa

A tela estava usando a estrutura legada:
- tabela `linhas`;
- campo `produtos.linha_id`.

O fluxo técnico atual do Atlas usa:
- `linhas_tecnicas`;
- relação `linha_produtos`.

Esse é o mesmo relacionamento usado pelo seletor de orçamento da PR #177.

## Correção

- carregar linhas com `listarLinhasTecnicas()`;
- contar produtos a partir de `linha.produto_ids`;
- filtrar os cards pela relação técnica `linha_produtos`;
- manter as categorias `produto` e `porta_janela_padrao` unificadas apenas para navegação;
- não inferir linha por nome;
- não alterar nenhum registro de produto.

Sem migration e sem alteração de dados.
