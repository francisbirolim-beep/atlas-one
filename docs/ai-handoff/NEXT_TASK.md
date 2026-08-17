# NEXT_TASK.md — Atlas One

## TAREFA ATUAL

Validar as **93 divergências de unidade de medida** encontradas na reconciliação de acessórios e definir quais valores representam a unidade técnica/comercial correta antes de qualquer atualização ou importação.

## ESTADO DE PARTIDA

A reconciliação `ExportWWAcessorios.xlsx` x Atlas foi concluída na PR #147.

Resultado:
- fonte W.Vetro: 1.174 acessórios;
- Atlas atual: 392 acessórios;
- códigos em ambos: 389;
- `EXISTENTE_IGUAL`: 296;
- `EXISTENTE_DIVERGENTE`: 93;
- `FALTANTE_ATLAS`: 785;
- duplicados na origem: 0;
- sem código: 0;
- somente no Atlas: 3.

Relatório:
`docs/tecnico/reconciliacao-exportwwacessorios-2026-08-16.md`

## DIVERGÊNCIAS A VALIDAR

Todas as 93 divergências reais são de unidade:
- MT -> UN: 66;
- PR -> UN: 12;
- TB -> UN: 9;
- BR -> UN: 3;
- PT -> UN: 2;
- PC -> UN: 1.

Não houve divergência de descrição, NCM válido/seguro ou status ativo entre códigos correspondentes.

## PRÓXIMO PASSO OBRIGATÓRIO

Revisar os 93 itens divergentes por natureza do produto e decidir, item a item ou por grupo comprovadamente homogêneo, qual unidade deve ser mantida no Atlas.

Objetivo da revisão:
1. separar divergências claramente causadas pela extração histórica que gravou `UN` como placeholder;
2. identificar casos em que a unidade W.Vetro representa embalagem/fornecimento e não unidade de consumo técnico;
3. não converter automaticamente MT, PR, TB, BR, PT ou PC para outra unidade sem evidência;
4. registrar a decisão e a justificativa antes de qualquer `UPDATE`.

## MIGRATION DE IDENTIDADE TÉCNICA

Migration mergeada e ainda não aplicada:
`supabase/migrations/20260816210000_produtos_identidade_tecnica_v1.sql`

Não aplicar automaticamente.

A reconciliação confirmou que o modelo proposto consegue preservar:
- código técnico e código de origem;
- dados brutos de origem;
- NCM de origem separado do status validado;
- origem W.Vetro;
- múltiplos vínculos produto x linha.

Mas o apply em produção continua sendo uma ação separada e explícita via `Supabase Database Control`.

## APÓS A VALIDAÇÃO DAS UNIDADES

Sequência recomendada:
1. aprovar a regra/decisão dos 93 divergentes;
2. decidir explicitamente se aplica `20260816210000_produtos_identidade_tecnica_v1.sql` em produção;
3. após o schema estar ativo, preparar PR separada de carga;
4. inserir apenas os acessórios faltantes considerados seguros;
5. preservar `codigo_origem`, `dados_origem` e `origem = wvetro`;
6. não usar código técnico como falso `id_externo_wvetro`;
7. tratar divergentes em operação separada, sem sobrescrita silenciosa;
8. reexecutar `scripts/auditoria-produtos-wvetro.sql` e o export de reconciliação;
9. somente depois avançar para os 1.307 perfis de `ExportWWPerfil (1).xlsx`.

## DADOS DA ORIGEM QUE NÃO DEVEM SER VALIDADO AUTOMATICAMENTE

- `Linha = GERAL`: 955;
- Cor Única numérica: 891;
- NCM `0`: 156;
- NCM `12345678`: 65;
- outros NCM fora do formato de 8 dígitos: 20.

Esses valores devem ser preservados como origem e permanecer pendentes de validação técnica/fiscal quando aplicável.

## ITENS SOMENTE NO ATLAS

Preservar e não apagar automaticamente:
- `TELA-1000-GALV`;
- `TELA-132`;
- `TELA-254`.

## PERFIS — FASE POSTERIOR

`ExportWWPerfil (1).xlsx` possui 1.307 perfis e será tratado depois dos acessórios.

Já há sinais que exigem revisão antes de backfill, incluindo pesos fora da faixa comum e possíveis diferenças de unidade no tamanho de barra. Não corrigir automaticamente.

## CUIDADOS PERMANENTES

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- branch -> PR -> checks verdes -> merge manual;
- não aplicar migration automaticamente em produção;
- nenhum insert/update de dados de produto antes da etapa explicitamente aprovada;
- Plano de Corte parte do produto cadastrado;
- receita específica por produto tem prioridade;
- snapshot não altera receita mestre;
- fórmula não validada não gera medida;
- credenciais W.Vetro nunca ficam no frontend/browser em integração permanente.
