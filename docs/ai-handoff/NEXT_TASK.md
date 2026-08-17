# NEXT_TASK.md — Atlas One

## TAREFA ATUAL

A PR #147 está tecnicamente validada. O próximo gate é **merge manual**; depois do merge, decidir explicitamente se a migration corrigida deve ser aplicada em produção. Nenhuma carga de acessórios deve ocorrer antes disso.

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

## CHECKS DA CORREÇÃO TÉCNICA

No commit `235d31f0b3ec900f9eb06157ab1a75cd6133de26`, que contém a correção de migration/unidade/proveniência:
- `Supabase Database Control`: **success**;
- `Audit migration history`: **success**;
- `Dry-run pending migrations`: **success**;
- `Apply pending migrations`: **skipped**;
- `Build Validation`: **success**;
- `Vercel`: **success**.

Portanto a migration foi validada em dry-run, mas **não foi aplicada**.

## DESCOBERTA DE MODELAGEM — UNIDADE NÃO É UM CAMPO SIMPLES

Todas as 93 divergências reais são de unidade:
- MT -> UN: 66;
- PR -> UN: 12;
- TB -> UN: 9;
- BR -> UN: 3;
- PT -> UN: 2;
- PC -> UN: 1.

Não houve divergência de descrição, NCM válido/seguro ou status ativo entre códigos correspondentes.

A fonte também possui `Qtde Emb.`. Entre os divergentes há, por exemplo:
- PT com Qtde Emb. 121 e 89;
- PC com Qtde Emb. 8;
- MT com ocorrências de Qtde Emb. 50 e 1.

Isso impede assumir que a unidade da fonte é automaticamente a unidade operacional/consumo do Atlas.

O código atual confirma que `produtos.unidade` é operacional: ao selecionar um produto numa receita de Engenharia, a tela copia `produto.unidade` para a unidade do componente.

## CORREÇÃO FEITA NA MIGRATION — AINDA NÃO APLICADA

Migration:
`supabase/migrations/20260816210000_produtos_identidade_tecnica_v1.sql`

A versão anterior tinha uma premissa incorreta: tratava `unidade` atual como valor cru W.Vetro e classificava automaticamente produtos técnicos preexistentes como `origem = wvetro`.

A reconciliação provou que isso não é seguro.

A migration foi corrigida na PR #147 para:
- adicionar `unidade_origem`;
- adicionar `qtde_embalagem_origem`;
- manter `produtos.unidade` como unidade operacional/canônica existente;
- não fazer backfill da unidade de origem usando o `UN` atual;
- classificar produtos técnicos preexistentes como `origem = legado` até reconciliação;
- manter snapshot em `dados_origem` identificado como `atlas_legacy_pre_reconciliacao`;
- não fingir que o snapshot legado é o dado cru da base completa W.Vetro;
- continuar sem usar código técnico como falso `id_externo_wvetro`.

`lib/produtos.ts` também aceita os novos campos de origem para futura carga reconciliada.

## PRÓXIMO GATE MANUAL

1. revisar a PR #147;
2. fazer **merge manual** quando aprovado;
3. após o merge, rodar `Supabase Database Control` em modo `apply` somente se houver decisão explícita;
4. para apply em produção, exigir `confirmation = APPLY_PRODUCTION`;
5. confirmar que a migration foi realmente aplicada antes de considerar os novos campos ativos;
6. somente então abrir PR separada para carga de acessórios.

Não fazer merge automático e não fazer apply automático.

## REGRA PARA OS 93 DIVERGENTES

Não substituir `produtos.unidade` em lote.

Para cada item/grupo comprovadamente homogêneo, distinguir:
- unidade operacional/consumo no Atlas;
- unidade exatamente informada pelo W.Vetro (`unidade_origem`);
- quantidade de embalagem exatamente informada (`qtde_embalagem_origem`);
- eventual unidade de compra/estoque e fator de conversão — **somente se houver evidência e necessidade operacional**.

Não inventar a semântica de `Qtde Emb.`.

## APÓS A MIGRATION ESTAR ATIVA

Sequência recomendada:
1. preparar carga dos 785 faltantes seguros em PR separada;
2. para itens vindos da fonte real, gravar `origem = wvetro`, `codigo_origem`, `unidade_origem`, `qtde_embalagem_origem` e `dados_origem`;
3. não sobrescrever silenciosamente a `unidade` operacional dos 93 divergentes;
4. não usar código técnico como falso `id_externo_wvetro`;
5. reexecutar `scripts/auditoria-produtos-wvetro.sql` e a reconciliação;
6. somente depois avançar para os 1.307 perfis de `ExportWWPerfil (1).xlsx`.

## DADOS DA ORIGEM QUE NÃO DEVEM SER VALIDADOS AUTOMATICAMENTE

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

A existência desses itens é a razão pela qual nome/código legado, sozinho, não comprova `origem = wvetro`.

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
