# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — concluir e integrar PR #256 (PDV Venda Balcão multiunidade)

### Base já concluída

- PR #255 integrada: Compras → fiscal → fornecedores → Contas a Pagar → recebimento → estoque → custo médio + precificação balcão separada do custo técnico.
- PR #257 integrada: estoque multiunidade, locais/endereços, reservas e transferências.
- O GitHub continua sendo a única fonte da verdade do código.

### PR #256 — estado real

A PR #256 (`feat/pdv-balcao-v1`) está sincronizada com a `main` e implementa:

- `/balcao` para venda rápida;
- orçamento de balcão sem baixar estoque;
- consulta de preço com saldo da unidade e da rede;
- histórico de vendas e atendimento;
- caixa por ponto físico/unidade;
- Contas a Receber;
- relatórios do balcão;
- permissões independentes para venda, caixa e gestão;
- `CX01 — Caixa 01 — Balcão` e `CX02 — Caixa 02 — Esquadrias` na Matriz/GERAL;
- preço normal/promocional, margem real e preço mínimo;
- venda local com baixa imediata do estoque;
- venda usando outra unidade com reserva atômica e atendimento posterior;
- fila `/balcao/atendimentos` com fluxo `Reservado → Separando → Em entrega → Entregue`.

### Regra de atendimento entre unidades

- ao finalizar uma venda com estoque de outra unidade, o físico permanece na origem e a quantidade fica reservada;
- `Separando` não baixa físico e não cria outra reserva;
- `Em entrega` consome a reserva, baixa o físico da origem e registra exatamente uma saída de estoque;
- `Entregue` apenas confirma a entrega e não baixa estoque novamente;
- a RPC `avancar_atendimento_venda_balcao` é server-side/service-role.

Teste transacional com rollback aprovado para venda remota de 3 unidades sobre físico 5:
- reservado: físico 5 / reservado 3 / saída 0;
- separando: físico 5 / reservado 3 / saída 0;
- em entrega: físico 2 / reservado 0 / saída 3;
- entregue: físico 2 / reservado 0 / saída continua 3;
- resíduos de teste: zero.

Também foi validado em rollback:
- venda local baixa estoque imediatamente;
- venda remota reserva sem baixar físico;
- PIX gera entrada no caixa;
- boleto/a prazo gera parcelas nos vencimentos informados;
- nenhum vencimento é inventado.

### Migrations PDV aplicadas no Supabase

- `20260823233928_pdv_balcao_v1`;
- `20260823233952_pdv_balcao_recebimento_rpc`;
- `20260823234024_pdv_balcao_vencimentos`;
- `20260823234124_pdv_balcao_multiunidade`;
- `20260823235246_pdv_balcao_atendimento_reservado`.

### Controle de migrations

Foi identificado um desalinhamento histórico anterior ao PDV: migrations antigas da Engenharia estavam no repositório com timestamps diferentes dos números efetivamente aplicados no Supabase.

Correção adotada:
- renomear os arquivos locais para os números reais do histórico remoto, preservando o SQL existente;
- restaurar `20260823005257_editor_acessorios_tipologia` como marcador histórico, porque sua carga intermediária é integralmente substituída por `20260823005739_acessorios_pc2_pc4_wvetro`;
- remover a versão local-only `20260819150000_engenharia_campos_corte_preset_v1`;
- registrar de forma idempotente a garantia do campo `campos_corte` como migration remota/local oficial `20260824000956_garantir_campos_corte_preset`;
- **não usar `migration repair --status reverted`**, porque as migrations remotas são históricas e reais.

### Validação antes do merge

1. confirmar `Build Validation` verde no head final;
2. confirmar `Supabase Database Control` verde no head final;
3. obter preview Vercel do head final como `READY`; se o Hobby bloquear apenas por limite de builds, não interpretar como erro de código;
4. confirmar PR #256 `mergeable` e head estável;
5. atualizar corpo da PR com os resultados finais;
6. fazer merge manual;
7. confirmar deployment de produção `READY`;
8. fazer navegação autenticada por `/balcao`, `/balcao/caixa`, `/balcao/consulta-preco`, `/balcao/atendimentos`, `/balcao/historico`, `/balcao/contas-receber` e `/balcao/relatorios`, sem criar venda fictícia em produção.

## REGRA PERMANENTE DE PREÇO

**Nunca misturar preço de venda balcão com custo de tipologia.**

- `produtos.custo` = custo técnico/estoque usado por tipologias e obras;
- `produtos.preco` = preço normal da venda avulsa/balcão;
- `produtos.margem_percentual` = margem real, não markup;
- preço por margem real: `preço = custo ÷ (1 - margem/100)`;
- preço promocional pode substituir o normal no balcão;
- preço mínimo é piso comercial opcional;
- `ultimo_preco_vendido` só muda em venda realmente finalizada;
- orçamento/rascunho nunca preenche `ultimo_preco_vendido`.

## PRÓXIMA VALIDAÇÃO OPERACIONAL — NF REAL 3128

Depois de integrar e confirmar produção da #256, retomar a NF real 3128 sem contaminar estoque/financeiro com testes desnecessários.

Referência confirmada:
- fornecedor LCT MAZARO IND E COM ARTIGOS SERRALHERIA;
- CNPJ `39.513.137/0001-85`;
- NF `3128`, série `1`, emissão `03/03/2026`;
- total `R$ 1.403,00`;
- `AL396PR50`: PCT 2 × R$30 = R$60;
- `AL395PR50`: PCT 2 × R$37,50 = R$75;
- `AL332PR50`: PCT 8 × R$17,50 = R$140;
- `AL331PR50`: PCT 4 × R$30 = R$120;
- `ALS1`: UN 40 × R$25,20 = R$1.008;
- parcelas: 31/03/2026 R$701,50 e 14/04/2026 R$701,50.

Regras obrigatórias para essa validação:
- não vincular produto por mera semelhança;
- não criar produto automaticamente;
- não assumir `1 PCT = 50 UN` sem confirmação explícita da descrição/origem;
- não inventar margem de venda;
- XML é a fonte fiscal preferencial; PDF/DANFE é leitura assistida;
- confirmação fiscal não movimenta estoque;
- estoque só entra após recebimento físico com produto + conversão válidos;
- quantidade avariada não entra como disponível.

## DEPOIS

- validar Plano de Corte final A4 para PC2, PC3 e PC4 Suprema em `2000 × 2100`;
- continuar validação estrutural Suprema 3F–9F, principalmente marcos/trilhos compostos acima de 6 planos;
- validar Central do Cliente;
- validar Assistência em campo, GPS/tempo, assinaturas e PDF;
- definir permissões específicas de Compras/Financeiro para Gabi;
- tratar hardening antigo da Engenharia em tarefa separada, sem habilitar RLS às cegas.
