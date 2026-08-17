# NEXT_TASK.md — Atlas One

## TAREFA ATUAL

A PR #147 foi mergeada em `main` no commit `dee7af37b0bc31a024988b456e039a5beefd5cdd`.

A reconciliação dos acessórios W.Vetro está concluída e **não deve ser refeita**.

O próximo gate é decidir explicitamente se a migration corrigida de identidade técnica deve ser aplicada em produção:

`supabase/migrations/20260816210000_produtos_identidade_tecnica_v1.sql`

A migration já passou em dry-run, mas **ainda não foi aplicada em produção**.

## ESTADO DA RECONCILIAÇÃO

Fonte W.Vetro:
- 1.174 acessórios.

Atlas atual:
- 392 acessórios.

Resultado por código técnico normalizado:
- códigos nos dois lados: 389;
- `EXISTENTE_IGUAL`: 296;
- `EXISTENTE_DIVERGENTE`: 93;
- `FALTANTE_ATLAS`: 785;
- `DUPLICADO_ORIGEM`: 0;
- `SEM_CODIGO`: 0;
- somente no Atlas: 3.

Itens somente no Atlas, que não devem ser apagados automaticamente:
- `TELA-1000-GALV`;
- `TELA-132`;
- `TELA-254`.

Relatório:
`docs/tecnico/reconciliacao-exportwwacessorios-2026-08-16.md`

## DIVERGÊNCIAS DE UNIDADE

As 93 divergências reais são somente de unidade:
- MT -> UN: 66;
- PR -> UN: 12;
- TB -> UN: 9;
- BR -> UN: 3;
- PT -> UN: 2;
- PC -> UN: 1.

Não sobrescrever `produtos.unidade` em lote.

A fonte também possui `Qtde Emb.`. Por isso o modelo separa:
- `produtos.unidade`: unidade operacional/canônica do Atlas;
- `produtos.unidade_origem`: unidade exatamente recebida da fonte;
- `produtos.qtde_embalagem_origem`: quantidade de embalagem exatamente recebida da fonte.

Não inventar fator de conversão nem interpretar automaticamente `Qtde Emb.`.

## MIGRATION PENDENTE

A migration corrigida adiciona/prepara, entre outros:
- `codigo`;
- `codigo_origem`;
- `origem`;
- `id_externo_wvetro`;
- `peso_kg_m`;
- `tamanho_barra_mm`;
- `tamanho_barra_mm_origem`;
- `unidade_origem`;
- `qtde_embalagem_origem`;
- `dados_origem`;
- status de validação;
- NCM de origem/status;
- `produto_linhas` N:N.

Backfill corrigido:
- registros técnicos preexistentes ficam `origem = legado` até reconciliação real;
- `UN` legado não vira falso `unidade_origem`;
- `dados_origem` legado usa `snapshot_tipo = atlas_legacy_pre_reconciliacao`;
- código técnico não vira falso `id_externo_wvetro`.

## PRÓXIMO PASSO OPERACIONAL

Somente com autorização explícita:
1. executar `Supabase Database Control` em modo `apply`;
2. usar confirmação exata `APPLY_PRODUCTION`;
3. confirmar que a migration foi aplicada de fato;
4. só então preparar PR separada para carregar os 785 acessórios faltantes considerados seguros;
5. preencher os campos de origem a partir da fonte real sem sobrescrever silenciosamente a unidade operacional;
6. reexecutar auditoria/reconciliação depois da carga;
7. tratar os 93 divergentes segundo uso em Engenharia, Compras e Estoque;
8. depois avançar para os 1.307 perfis de `ExportWWPerfil (1).xlsx`.

## FILTRO POR LINHA — JÁ MERGEADO

A PR #148 foi mergeada em `main` no commit `9427c57b794d3116a68cf6401d8542b2ac9e88af`.

A tela `Cadastro > Produtos` possui filtro por Linha combinado com a busca textual existente. Não refazer essa tarefa.

## DADOS DA ORIGEM QUE NÃO DEVEM SER VALIDADOS AUTOMATICAMENTE

- `Linha = GERAL`: 955;
- Cor Única numérica: 891;
- NCM `0`: 156;
- NCM `12345678`: 65;
- outros NCM fora do formato de 8 dígitos: 20.

## CUIDADOS PERMANENTES

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- branch -> PR -> checks verdes -> merge manual;
- migration só conta como ativa após apply confirmado;
- nenhum insert/update de produto antes da etapa explicitamente aprovada;
- não inventar NCM, linha, cor, unidade, custo, preço, fator de conversão ou identificador externo;
- Plano de Corte parte do produto cadastrado;
- receita específica por produto tem prioridade;
- snapshot não altera receita mestre;
- fórmula não validada não gera medida;
- credenciais W.Vetro nunca ficam no frontend/browser em integração permanente.

## ORÇAMENTO — HISTÓRICO DE VERSÕES — PR #150

A PR #150 já foi mergeada no commit `2e983943fab550f7e32d0adeff0806a3dae2458c`.

Não refazer esta tarefa. O comportamento esperado é:
- nova versão de orçamento gera Versão 01/02/03... com data e hora;
- versões anteriores ficam preservadas;
- legado sem data individual não recebe timestamp inventado;
- reenvio individual fica registrado no histórico;
- envio de versão nova não manda novamente os PDFs Atlas antigos.

Essa melhoria não altera o próximo gate principal da base de produtos: a migration `20260816210000_produtos_identidade_tecnica_v1.sql` continua dependendo de autorização explícita para apply em produção.

## ORÇAMENTO FINALIZADO — ANEXO PERMANENTE — PR #152

A PR #152 já foi mergeada no commit `a7679d9bd103a56e838d1e4376232c65d0e9f75a`.

Não refazer esta correção. Em orçamento finalizado, a área `Anexar novo orçamento / revisão` deve permanecer disponível e o upload deve ser persistido imediatamente, preservando todos os anexos anteriores.

A tarefa principal de produtos/migration continua separada desta correção de interface.
