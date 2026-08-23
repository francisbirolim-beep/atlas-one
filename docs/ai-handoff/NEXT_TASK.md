# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar fluxo completo de Compras com uma NF real

A decisão operacional atual é o **Atlas ser a fonte de entrada e conferência das notas de compra**. O W.Vetro continua servindo como referência histórica/técnica, mas as NFs de compra não são alimentadas naquele sistema.

### Estado implementado

PR #247 — Entrada de NF, já em produção:
- `/compras/entrada` aceita `XML da NF-e`, `PDF / DANFE` e `Manual`;
- prévia antes de gravar;
- XML lê chave, número, série, emissão, fornecedor/CNPJ, totais e itens;
- item tenta correspondência exata por cadastro existente;
- produto não reconhecido fica `pendente` e não é criado automaticamente;
- XML/PDF original vai para bucket privado `compras-nfs`;
- atualização de custo é opção explícita e vem desligada.

PR #248 — Central, Histórico e vínculos, já em produção.

PR #249 — Conferência de recebimento, já em produção, sem movimentação automática de estoque.

### Validação real PDF/DANFE — NF 3128

PDF real validado em 23/08/2026:
- NF 000.003.128, série 1, emissão 03/03/2026;
- emitente LCT MAZARO IND E COM ARTIGOS SERRALHERIA;
- CNPJ 39.513.137/0001-85;
- chave 35260339513137000185550010000031281004278066;
- valor total/produtos R$ 1.403,00;
- 5 itens reais: AL396PR50, AL395PR50, AL332PR50, AL331PR50 e ALS1.

O parser anterior encontrou só 4 itens e somou R$ 395,00; também contaminou alguns códigos, não recompôs integralmente descrições, confundiu protocolo `135260...` com chave de acesso e deixou CNPJ vazio.

A implementação atual em validação corrige:
- total com separador de milhar (`1.008,00`), necessário para ALS1;
- normalização de códigos AL... mesmo quando o `pdf-parse` cola texto antes do código;
- reconstrução de descrições quebradas;
- busca de chave fiscal e CNPJ do emitente;
- confronto soma dos itens x valor dos produtos, com alerta de divergência.

### Validar agora — ordem obrigatória

1. publicar a correção do parser validada contra a NF 3128;
2. reenviar o mesmo PDF em `/compras/entrada`;
3. exigir 5 itens e soma R$ 1.403,00;
4. exigir códigos AL396PR50, AL395PR50, AL332PR50, AL331PR50 e ALS1 sem ruído;
5. exigir CNPJ 39.513.137/0001-85 e chave fiscal correta;
6. manter `Atualizar custo` desligado e não confirmar até todos os dados fecharem;
7. depois testar um XML real como fonte fiscal preferencial;
8. só depois definir política de custo e movimentação de estoque por unidade/embalagem.

## INTEGRAÇÃO W.VETRO — estado preservado

A conexão direta Atlas One ↔ W.Vetro está validada em produção. No recorte 26/05/2026–23/08/2026 foram encontrados 72 tipologias, 1.069 perfis, 756 acessórios e 15 vidros. A reconciliação usa a base completa de 2.485 produtos. Como as NFs de compra não são alimentadas no W.Vetro, `CustoVlr` dos orçamentos/pedidos é apenas referência histórica e não deve virar custo oficial automaticamente.

## REGRAS DE SEGURANÇA

- GitHub continua sendo a fonte da verdade do código do Atlas;
- XML/PDF e fotos permanecem em buckets privados;
- produto não reconhecido nunca é criado automaticamente;
- atualização de custo exige vínculo + confirmação explícita;
- corrigir vínculo depois não aplica custo retroativamente sem ação separada;
- não gerar movimento de estoque enquanto unidade de compra/estoque e conversões não estiverem validadas;
- preservar fórmulas técnicas e preços de venda.

## DEPOIS — validar Plano de Corte final A4

Após validar o fluxo inicial de Compras, retomar o Plano de Corte A4 e depois a validação estrutural das fórmulas Suprema 3F–9F.
