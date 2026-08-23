# Implementação — Compras ERP + Estoque + Financeiro + Precificação Balcão

Data: 2026-08-23
PR: #255
Branch: `feat/compras-estoque-financeiro`

## Escopo

Evoluir a entrada de NF já existente para um fluxo integrado e auditável:

`NF → Fiscal → Fornecedor → Vínculo/Cadastro → Contas a Pagar → Recebimento → Estoque → Custo médio`

## Fiscal

- XML NF-e lê tributos totais e por item quando disponíveis: ICMS, ICMS-ST, IPI, PIS e COFINS.
- Totais também guardam frete, seguro, desconto e outras despesas.
- Duplicatas/pagamentos são lidos para prévia do Financeiro.
- PDF/DANFE usa leitura assistida; XML continua sendo a fonte preferencial para dados fiscais completos.

## Produtos e fornecedores

- Código exato pode vincular automaticamente.
- Sem código exato, similaridade por descrição/NCM gera apenas sugestões.
- Produto novo exige confirmação explícita.
- `produto_fornecedores` memoriza fornecedor + código + unidade de compra + fator de conversão.
- Unidade de compra e unidade operacional permanecem separadas.

## Custos

- O item da NF guarda custo bruto de aquisição.
- Frete, seguro, outras despesas, desconto, IPI e ST podem compor o custo conforme a implementação.
- Créditos de ICMS/PIS/COFINS não são presumidos automaticamente.
- Estoque utiliza custo médio após recebimento físico.

## Estoque

- NF confirmada não gera saldo por si só.
- Entrada ocorre no recebimento físico.
- Avaria não entra como estoque disponível.
- Item sem produto ou conversão validada fica pendente.
- `estoque_saldos` mantém saldo/custo médio/valor.
- `estoque_movimentos` mantém razão auditável.

## Financeiro

- A confirmação da NF pode gerar Contas a Pagar.
- Parcelas da NF são preservadas quando identificadas.
- Tela `/financeiro/contas-pagar` mostra lançamentos gerados.

## Precificação balcão — decisão permanente

- `produtos.custo`: custo técnico/estoque, usado pelas tipologias e custo da obra.
- `produtos.preco`: preço normal de venda avulsa/balcão.
- `produtos.margem_percentual`: margem real, não markup.
- Fórmula: `preço = custo / (1 - margem/100)`.
- Inversa: `margem = (preço - custo) / preço * 100`.
- `preco_minimo`: piso opcional de venda.
- `preco_promocional`: preço promocional opcional.
- `ultimo_preco_vendido`: reservado a venda efetivamente confirmada; orçamento em rascunho não preenche.
- Tipologias nunca devem consumir `produtos.preco` para formar custo.
- Venda balcão nunca deve aplicar novamente a margem global da tipologia.
- O cadastro principal de Produtos e a Central de Precificação usam a mesma fórmula de margem real.
- A Venda Balcão permite preço unitário por linha, mostra a margem real resultante e bloqueia preço abaixo do mínimo.
- Nenhuma margem padrão de categoria é criada sem validação comercial explícita.

## Migrações remotas

- `20260823181223_compras_fiscal_estoque_financeiro`
- `20260823181320_produto_fornecedor_conflict_key`
- `20260823184307_produtos_precificacao_balcao`

Todas as tabelas operacionais novas de Compras/Estoque/Financeiro permanecem com RLS habilitado e acesso pelas rotas server-side.

## Validação de referência

NF real 3128 da LCT Mazaro:
- CNPJ `39.513.137/0001-85`;
- 5 itens;
- total R$ 1.403,00;
- parcelas 31/03/2026 e 14/04/2026, R$ 701,50 cada.

## Estado de build

- preview Vercel do último commit funcional `cbcfe918583e9b03766b5be07744303aefc6c9a2` ficou `READY` em 23/08/2026;
- esse build compilou `/compras/entrada`, `/estoque`, `/financeiro/contas-pagar`, `/cadastro/produtos`, `/cadastro/produtos/precificacao` e `/orcamento/balcao/novo`;
- commits posteriores são documentação/handoff; o merge permanece manual conforme a governança.

A NF 3128 é o caso de teste principal antes do merge/produção da PR #255.
