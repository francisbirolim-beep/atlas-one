# Implementação — Compras ERP + Estoque + Financeiro + Precificação Balcão

Data: 2026-08-23
PR: #255
Branch: `feat/compras-estoque-financeiro`

## Escopo

`NF → Fiscal → Fornecedor → Vínculo/Cadastro → Contas a Pagar → Recebimento → Estoque → Custo médio`

## Implementado

- XML NF-e lê tributos totais e por item: ICMS, ICMS-ST, IPI, PIS e COFINS quando presentes.
- Totais guardam frete, seguro, desconto e outras despesas.
- Duplicatas/pagamentos são lidos para prévia do Financeiro.
- PDF/DANFE usa leitura assistida; XML continua preferencial para fiscal completo.
- Código exato pode vincular automaticamente; similaridade por descrição/NCM gera somente sugestões.
- Produto novo exige confirmação explícita.
- `produto_fornecedores` memoriza fornecedor, código, unidade de compra e fator de conversão.
- Unidade de compra e unidade operacional permanecem separadas.
- Custo bruto de aquisição pode considerar frete, seguro, despesas, desconto, IPI e ST; créditos de ICMS/PIS/COFINS não são presumidos.
- NF confirmada não aumenta estoque; entrada ocorre no recebimento físico.
- Avaria não entra no disponível; item sem vínculo/conversão fica pendente.
- `estoque_saldos` mantém saldo/custo médio/valor e `estoque_movimentos` mantém razão auditável.
- Confirmação da NF pode gerar `financeiro_contas_pagar`.
- Telas `/estoque` e `/financeiro/contas-pagar` adicionadas.

## Precificação balcão — decisão permanente

- `produtos.custo` = custo técnico/estoque usado por tipologias e custo da obra.
- `produtos.preco` = preço normal de venda avulsa/balcão.
- `produtos.margem_percentual` = margem real, não markup.
- `preço = custo / (1 - margem/100)`.
- `margem = (preço - custo) / preço * 100`.
- `preco_minimo` = piso comercial opcional.
- `preco_promocional` = preço promocional opcional.
- `ultimo_preco_vendido` é reservado a venda efetivamente confirmada; orçamento em rascunho não preenche.
- Tipologias nunca devem consumir `produtos.preco` para formar custo.
- Venda balcão não recebe novamente a margem global da tipologia.
- Cadastro de Produtos e Central de Precificação usam a mesma fórmula de margem real.
- Venda Balcão permite preço unitário por linha, mostra margem real e bloqueia preço abaixo do mínimo.
- Nenhuma margem padrão por categoria foi inventada.

## Migrações remotas

- `20260823181223_compras_fiscal_estoque_financeiro`
- `20260823181320_produto_fornecedor_conflict_key`
- `20260823184307_produtos_precificacao_balcao`

As tabelas novas de Compras/Estoque/Financeiro permanecem com RLS habilitado e acesso pelas rotas server-side.

## Referência de validação

NF 3128 — LCT Mazaro — CNPJ `39.513.137/0001-85` — 5 itens — R$ 1.403,00 — parcelas de R$ 701,50 em 31/03/2026 e 14/04/2026.

## Build

Preview Vercel do último commit funcional `cbcfe918583e9b03766b5be07744303aefc6c9a2`: `READY`, compilando as novas rotas e telas. Commits posteriores são documentação/handoff. Merge permanece manual.
