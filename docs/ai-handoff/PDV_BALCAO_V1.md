# PDV Venda Balcão multiunidade — Atlas One

Data: 2026-08-23
PR: #256
Branch: `feat/pdv-balcao-v1`
Base: `main` já contendo Compras, Estoque multiunidade e endereçamento.

## Objetivo

Criar um ambiente de balcão separado do restante do ERP, simples para o operador e integrado a Produtos, Estoque, Clientes, Caixa e Financeiro, preparado para a Matriz e futuras lojas/unidades.

## Telas

- `/balcao` — venda rápida / PDV;
- `/balcao/orcamentos` e `/balcao/orcamentos/novo` — orçamento sem movimentar estoque/caixa;
- `/balcao/consulta-preco` — preço + disponibilidade nesta unidade e na rede;
- `/balcao/atendimentos` — fila de reservas atendidas por outra unidade;
- `/balcao/historico` — histórico da venda e status da mercadoria;
- `/balcao/caixa` — abertura, suprimento, sangria, movimentos e fechamento;
- `/balcao/contas-receber` — recebimentos a prazo;
- `/balcao/relatorios` — indicadores gerenciais restritos;
- `/balcao/clientes/novo` — cadastro rápido de cliente.

## Caixa e unidade

O PDV separa **ponto de caixa** da sessão diária do operador.

Pontos iniciais criados:
- `CX01 — Caixa 01 — Balcão`;
- `CX02 — Caixa 02 — Esquadrias`.

Hoje ambos pertencem à `MATRIZ` e usam `GERAL` como estoque padrão. Novas lojas podem criar seus próprios pontos de caixa ligados à respectiva unidade/local.

Ao abrir o caixa, o operador escolhe qual ponto físico está usando. Um ponto não pode possuir duas sessões abertas ao mesmo tempo.

## Estoque da rede

Produto continua sendo cadastro único da empresa.

O catálogo do PDV consulta `estoque_disponibilidade_rede` e apresenta:
- disponível na unidade/local do caixa;
- disponível total da rede;
- saldo das demais unidades;
- quantidade reservada.

### Venda local

Quando o produto sai do local de estoque do próprio caixa:
1. o Atlas reserva atomicamente a quantidade;
2. a reserva é consumida na mesma transação;
3. o saldo físico e reservado são reduzidos;
4. é gravado `estoque_movimentos` de saída;
5. o item já nasce como `entregue`.

### Venda atendida por outra unidade

Quando o vendedor escolhe estoque de outra unidade:
1. a venda é finalizada normalmente;
2. a quantidade fica reservada na unidade de origem;
3. o físico ainda não é reduzido;
4. o item fica `reservado_outra_unidade`;
5. a venda fica `aguardando_separacao`;
6. a fila `/balcao/atendimentos` passa a controlar o restante.

Fluxo da fila:
`Reservado → Separando → Em entrega → Entregue`

Regras:
- `Separando`: não altera físico nem cria nova reserva;
- `Em entrega`: consome a reserva, baixa o físico da origem e cria exatamente uma saída de estoque;
- `Entregue`: somente confirma a entrega; não baixa estoque de novo;
- RPC `avancar_atendimento_venda_balcao` é idempotente para repetição da mesma etapa e restrita ao `service_role`.

## Regras comerciais permanentes

- Tipologias/esquadrias usam `produtos.custo`; margem é aplicada no orçamento da esquadria.
- Venda balcão usa `produtos.preco` / preço promocional e margem própria do produto.
- `margem_percentual` significa margem real, não markup.
- Custo e margem ficam ocultos para operador sem permissão gerencial.
- Venda abaixo do preço mínimo exige autorização gerencial.
- `ultimo_preco_vendido` só é atualizado em venda realmente finalizada, nunca em orçamento.

## Financeiro

- Pagamento pode ser simples ou misto.
- Dinheiro, PIX, débito, crédito e outros recebimentos imediatos geram movimento do caixa.
- Boleto e venda a prazo exigem cliente identificado e primeiro vencimento informado.
- O Atlas não inventa vencimento.
- Parcelas são gravadas em `financeiro_contas_receber`.
- Baixa de conta a receber exige caixa aberto e gera movimento de recebimento.

## Segurança

- Rotas do PDV exigem sessão Atlas válida.
- Permissões independentes para operação de venda, caixa e relatórios/gestão.
- Tabelas transacionais do PDV têm RLS habilitado e acesso direto de `anon/authenticated` revogado.
- RPCs críticas do PDV executam apenas por `service_role`.
- Advisors após as migrations não apontaram nova RPC pública ligada ao PDV.
- Os ERRORs de RLS encontrados continuam sendo tabelas antigas da Engenharia e devem ser tratados em hardening separado, sem mudança automática nesta PR.

## Migrações aplicadas no Supabase

- `20260823233928_pdv_balcao_v1.sql`;
- `20260823233952_pdv_balcao_recebimento_rpc.sql`;
- `20260823234024_pdv_balcao_vencimentos.sql`;
- `20260823234124_pdv_balcao_multiunidade.sql`;
- `20260823235246_pdv_balcao_atendimento_reservado.sql`.

Os arquivos do repositório estão alinhados com as versões remotas.

## Validações já executadas

### Venda local + venda remota
Teste transacional com `ROLLBACK`:
- venda local baixou estoque imediatamente;
- venda remota preservou físico e criou reserva;
- PIX entrou no caixa;
- boleto gerou duas parcelas com os vencimentos informados;
- resíduos de teste após rollback: zero.

### Atendimento remoto
Teste transacional com origem contendo 5 unidades e venda de 3:
- após venda: físico `5`, reservado `3`, saída `0`;
- após `Separando`: físico `5`, reservado `3`, saída `0`;
- após `Em entrega`: físico `2`, reservado `0`, saída acumulada `3`, reserva `atendida`;
- após `Entregue`: físico `2`, reservado `0`, saída permanece `3`;
- resíduos após rollback: zero.

## Antes do merge da PR #256

1. obter preview Vercel da cabeça final da PR como `READY`;
2. conferir no build as rotas `/balcao`, `/balcao/atendimentos`, `/balcao/caixa`, `/balcao/consulta-preco`, `/balcao/historico`, `/balcao/contas-receber` e `/balcao/relatorios`;
3. atualizar o corpo da PR com o resultado final;
4. merge manual;
5. confirmar deployment de produção `READY`;
6. fazer uma navegação real autenticada sem criar venda fictícia em produção.

## Evoluções posteriores

- cancelamento/devolução com estorno auditável de estoque, caixa e financeiro;
- impressão/NFC-e quando a política fiscal e o provedor forem definidos;
- configuração administrativa de novos pontos de caixa por loja;
- opção de transferir mercadoria para a loja vendedora antes da retirada, quando o fluxo exigir transferência física entre unidades em vez de entrega direta ao cliente.
