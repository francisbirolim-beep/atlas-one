# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar PR #255 com a NF real 3128 e depois integrar manualmente

A decisão operacional atual é o **Atlas ser a fonte de entrada, conferência, estoque e financeiro das compras**. O W.Vetro permanece como referência histórica/técnica, porque as NFs de compra não são alimentadas naquele sistema.

### Já está em produção

- PR #247: entrada de NF em `/compras/entrada` por XML NF-e, PDF/DANFE ou Manual;
- PR #248: Central de Compras, histórico de NFs e fila de vínculos;
- PR #249: conferência física com recebimentos parciais, falta/excesso/avaria e fotos privadas;
- PRs #250–#253: evolução do leitor de DANFE validada contra a NF real 3128 da LCT Mazaro;
- DANFE 3128 já lê corretamente 5 itens, CNPJ, chave, quantidade, valores e total de R$ 1.403,00.

### PR #255 — pronta para teste/merge manual

A PR #255 (`feat/compras-estoque-financeiro`) implementa o pipeline:

`NF → fiscal → fornecedor → vínculo/cadastro → Contas a Pagar → recebimento físico → estoque → custo médio`

Implementado:
- XML lê ICMS, ICMS-ST, IPI, PIS, COFINS, frete, seguro, desconto, outras despesas e duplicatas/pagamentos quando presentes;
- PDF/DANFE tenta leitura assistida desses campos; para escrituração fiscal, XML continua sendo a fonte preferencial;
- produto sem código exato recebe somente **sugestões** por descrição/NCM; sem associação automática por semelhança;
- item pendente pode usar `Cadastrar produto a partir da NF`, sempre com confirmação explícita;
- `produto_fornecedores` memoriza o código daquele fornecedor e o fator de conversão para próximas compras;
- unidade de compra e unidade de estoque permanecem separadas; não copiar `unidade_origem` automaticamente para `produtos.unidade`;
- custo bruto de aquisição considera produto + IPI/ST + rateio de frete/seguro/outras despesas − desconto; créditos de ICMS/PIS/COFINS não são presumidos automaticamente;
- confirmação da NF pode gerar `financeiro_contas_pagar` a partir das parcelas da nota;
- estoque **não** entra na confirmação fiscal: só entra após conferência física;
- quantidade avariada não entra no saldo disponível;
- item sem produto ou sem fator de conversão fica pendente e não gera quantidade incorreta;
- `estoque_saldos` guarda quantidade, custo médio e valor do estoque;
- `estoque_movimentos` mantém o razão auditável por recebimento;
- telas `/estoque` e `/financeiro/contas-pagar` adicionadas;
- tabelas novas operam server-side, com RLS habilitado e sem políticas diretas de client;
- migrations remotas aplicadas: `20260823181223_compras_fiscal_estoque_financeiro` e `20260823181320_produto_fornecedor_conflict_key`.

### Regra permanente de precificação — validada em 2026-08-23

**Nunca misturar preço de venda balcão com custo de tipologia.**

- `produtos.custo` = custo técnico/estoque, usado por tipologias, receitas e custo da obra;
- a margem da esquadria continua sendo aplicada no fechamento/global do orçamento conforme regra comercial;
- `produtos.preco` = preço normal de venda balcão/avulsa;
- `produtos.margem_percentual` = **margem real de venda balcão**, não markup;
- fórmula: `preço = custo ÷ (1 - margem/100)`;
- fórmula inversa: `margem = (preço - custo) ÷ preço × 100`;
- `preco_minimo` = piso comercial opcional;
- `preco_promocional` = preço promocional opcional;
- `ultimo_preco_vendido` fica reservado para uma venda efetivamente confirmada; criar um orçamento não preenche esse campo;
- migration `20260823184307_produtos_precificacao_balcao` aplicada no Supabase;
- o único produto legado que tinha margem em formato markup preservou custo/preço e teve somente a porcentagem convertida para margem real;
- `/cadastro/produtos/precificacao` virou a central de precificação balcão;
- `/orcamento/balcao/novo` começa pelo preço promocional quando houver, senão preço normal; permite editar o preço da linha, mostra a margem real resultante e bloqueia preço abaixo do mínimo;
- ao cadastrar produto a partir de NF, o Atlas mostra custo de compra, custo por unidade de estoque, campo de margem balcão e preço sugerido;
- nenhuma margem padrão por categoria foi inventada; margens sugeridas por categoria só devem ser adicionadas quando configuradas/validadas pelo usuário.

### NF real 3128 — referência de validação

Fornecedor: LCT MAZARO IND E COM ARTIGOS SERRALHERIA
CNPJ: `39.513.137/0001-85`
NF: `3128`, série `1`, emissão `03/03/2026`
Total produtos/NF: `R$ 1.403,00`

Itens esperados:
1. `AL396PR50` — PCT 2 × R$ 30,00 = R$ 60,00;
2. `AL395PR50` — PCT 2 × R$ 37,50 = R$ 75,00;
3. `AL332PR50` — PCT 8 × R$ 17,50 = R$ 140,00;
4. `AL331PR50` — PCT 4 × R$ 30,00 = R$ 120,00;
5. `ALS1` — UN 40 × R$ 25,20 = R$ 1.008,00.

Parcelas esperadas no DANFE:
- 31/03/2026 — R$ 701,50;
- 14/04/2026 — R$ 701,50.

Os cinco códigos não existiam no catálogo Atlas na conferência de 23/08/2026; não vincular por mera semelhança.

### Validar agora — ordem obrigatória

1. aguardar/confirmar preview Vercel da **última cabeça da PR #255** como `READY`;
2. abrir o preview da branch e entrar com uma sessão real do Atlas;
3. carregar novamente o PDF da NF 3128;
4. confirmar 5 itens, CNPJ, chave, total e parcelas;
5. observar os impostos identificados; lembrar que PDF é leitura assistida e XML é preferencial para fiscal completo;
6. em pelo menos um item PCT, abrir `Cadastrar produto a partir da NF`;
7. conferir explicitamente `1 PCT = 50 UN` apenas quando a descrição realmente indicar pacote com 50 peças;
8. definir uma margem balcão de teste manualmente e confirmar que o preço usa **margem real**, não markup;
9. não inventar margem para os demais itens; campo pode ficar sem margem/preço até a política comercial ser definida;
10. confirmar que `Gerar Contas a Pagar` mostra as duas parcelas de R$ 701,50 e totaliza R$ 1.403,00;
11. somente então confirmar a NF de teste;
12. abrir Financeiro > Contas a Pagar e validar os lançamentos;
13. abrir a conferência física; confirmar quantidades recebidas, avarias e divergências;
14. confirmar que estoque só recebe item com vínculo + conversão validada e que avaria não entra como disponível;
15. abrir `/estoque` e conferir quantidade convertida, custo médio e razão de movimentos;
16. abrir `/cadastro/produtos/precificacao` e conferir custo técnico separado de preço/margem balcão;
17. testar `/orcamento/balcao/novo`: preço normal/promocional, alteração manual, margem real e bloqueio abaixo do mínimo;
18. depois da validação, fazer o **merge manual da PR #255** e conferir deploy de produção `READY`.

## REGRAS DE SEGURANÇA

- GitHub continua sendo a fonte da verdade do código do Atlas;
- XML/PDF e fotos de recebimento permanecem em buckets privados;
- produto não reconhecido nunca deve ser criado automaticamente a partir de XML/PDF;
- similaridade por descrição/NCM serve somente como sugestão;
- não gerar estoque antes do recebimento físico;
- não gerar quantidade de estoque sem vínculo e conversão válidos;
- não copiar `unidade_origem` para `produtos.unidade` automaticamente;
- não descontar créditos de ICMS/PIS/COFINS sem política fiscal validada;
- tipologia usa `produtos.custo`; venda balcão usa `produtos.preco`;
- não aplicar margem de balcão dentro da tipologia;
- não preencher `ultimo_preco_vendido` quando existir apenas orçamento/rascunho.

## DEPOIS — Plano de Corte final A4

Depois da validação do fluxo completo de Compras:
1. validar PC2, PC3 e PC4 Suprema em `2000 x 2100`;
2. conferir logo, cliente, obra, ambiente, cor, perfis, acessórios e vidro;
3. confirmar uma única folha A4;
4. continuar a validação estrutural Suprema 3F–9F, especialmente marcos/trilhos compostos acima de 6 planos.

## OUTRAS VALIDAÇÕES PENDENTES

- Cadastro do cliente como central operacional.
- Assistência em campo com rota, GPS e tempo.
- Link do técnico, assinaturas e PDF direto.
- Navegação organizada e Central de Cadastros.
- permissões específicas de Compras/Financeiro para a Gabi.
