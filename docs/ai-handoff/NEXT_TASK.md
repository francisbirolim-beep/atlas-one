# NEXT_TASK.md — Atlas One

## ESTADO ATUAL — PERFIS W.VETRO CONCLUÍDOS EM PRODUÇÃO — 2026-08-17

A frente de perfis W.Vetro está **concluída em produção**. A migration `20260817170000_reconciliar_proveniencia_perfis_wvetro_v1.sql` foi aplicada no run #86 (`32059852704`) com `APPLY_PRODUCTION` e `Finished supabase db push.`.

Não repetir auditoria, carga ou apply dos 1.307 perfis. Os trechos históricos abaixo que dizem que a migration está pendente devem ser ignorados.

Próxima frente recomendada de Produtos/Engenharia:
1. validar humanamente a unidade operacional dos 136 acessórios que permanecem com `produtos.unidade = NULL`;
2. manter `unidade_origem` e `qtde_embalagem_origem` como dados de proveniência, sem inferir fator de conversão;
3. só liberar cada item para fluxos técnicos/comerciais após unidade operacional validada;
4. em paralelo, continuar Engenharia/Plano de Corte usando apenas receitas e fórmulas tecnicamente validadas, sem inventar medidas.


## GATE ATUAL — APLICAR PROVENIÊNCIA DOS PERFIS W.VETRO — 2026-08-17

A PR #163 já foi mergeada em `main` no commit `0b4b4a145f89bd3ad52626cd23335fb7bef2043e`. O dry-run oficial do Supabase passou no run #85 (`32049150791`) e detectou somente:

`20260817170000_reconciliar_proveniencia_perfis_wvetro_v1.sql`

A migration **NÃO está aplicada em produção**. Não existe run de apply posterior ao dry-run #85.

Próximo passo é um gate humano explícito:
1. pedir autorização específica para aplicar esta migration em produção;
2. somente após autorização, executar `Supabase Database Control` na branch `main`;
3. `mode = apply`;
4. `confirmation = APPLY_PRODUCTION`;
5. acompanhar job/log até `Finished supabase db push.`;
6. verificar pós-estado dos 1.307 perfis antes de documentar como ativo.

Não interpretar mensagens genéricas como `pode continuar` como autorização deste apply.

Após o apply confirmado, atualizar handoff e então seguir para a próxima frente de Produtos/Engenharia.

## TAREFA ATUAL — PROVENIÊNCIA DOS 1.307 PERFIS W.VETRO — 2026-08-17

A auditoria/reconciliação da fonte `ExportWWPerfil (1)(1).xlsx` está concluída. **Não criar carga de novos perfis**: os 1.307 códigos da fonte já existem no Atlas, sem faltantes e sem exclusivos Atlas.

Estado reconciliado:
- fonte: 1.307;
- Atlas: 1.307;
- códigos correspondentes: 1.307;
- `EXISTENTE_IGUAL`: 1.235;
- `EXISTENTE_FONTE_NAO_PROMOVIDA`: 72;
- divergência operacional real: 0.

Próximo passo:
1. preparar migration exclusivamente de proveniência para os 1.307 perfis existentes;
2. gravar os valores crus em `codigo_origem`, `unidade_origem`, `tamanho_barra_mm_origem`, `ncm_origem` e `dados_origem`;
3. não promover automaticamente `Tamanho` para `tamanho_barra_mm`;
4. não sobrescrever nome, preço/custo, unidade operacional, peso, NCM operacional, marca, ativo, linha, cor ou ID externo;
5. incluir guardas transacionais de contagem, IDs/códigos e pós-check de zero alteração operacional;
6. validar em PR e dry-run;
7. somente depois de autorização explícita executar `Supabase Database Control` com `APPLY_PRODUCTION`.

Fonte com revisão pendente deve permanecer preservada, sem correção por suposição:
- 221 NCM placeholders;
- 18 NCM em formato atípico;
- 7 tamanhos atípicos;
- 2 pesos muito altos;
- 68 fabricantes numéricos `16`.

Relatório:
`docs/tecnico/reconciliacao-exportwwperfil-2026-08-17.md`.

Fila secundária permanece:
- validar humanamente a unidade operacional dos 136 acessórios pendentes;
- nunca inferir fator de conversão a partir de unidade/embalagem da fonte.

## TAREFA ATUAL — PERFIS W.VETRO — 2026-08-17

A etapa dos acessórios W.Vetro está **concluída em produção**. Os trechos antigos deste arquivo que tratam migrations de acessórios como pendentes são históricos e não devem orientar novas ações.

Estado confirmado:
- 1.174 acessórios da fonte W.Vetro reconciliados;
- 785 faltantes adicionados;
- 389 preexistentes enriquecidos com proveniência;
- 93 divergências de unidade preservadas;
- 136 acessórios permanecem com unidade operacional pendente e fora de fluxos que exigem unidade validada;
- 3 itens exclusivos do Atlas preservados.

Próxima frente principal:
1. localizar/usar a fonte real `ExportWWPerfil (1).xlsx`;
2. auditar os 1.307 perfis antes de qualquer escrita;
3. exportar o snapshot atual dos perfis Atlas em modo somente leitura;
4. reconciliar por código técnico, separando iguais, divergentes, faltantes e exclusivos Atlas;
5. preservar unidade, peso, tamanho de barra, linha, cor, NCM e demais campos de origem sem promover automaticamente dados não validados a verdade técnica;
6. somente depois preparar migrations de carga em PRs pequenas, com dry-run e apply explícito em produção.

Fila secundária:
- validar humanamente a unidade operacional dos 136 acessórios pendentes;
- nunca inferir fator de conversão a partir de `Qtde Emb.` ou unidade da fonte.

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

## CADASTRO — CATEGORIAS DINÂMICAS DE PRODUTOS — PR #154

A PR #154 já foi mergeada no commit `a4ae49e58ddd6317e903dfee1e032a8b8694a5f4`.

Não voltar a fixar `CategoriaProduto` em um union fechado nem reintroduzir a lista hardcoded como fonte operacional. Categorias novas devem continuar sendo criáveis pelo usuário e categorias legadas em uso devem permanecer visíveis.

Importante: nenhum produto existente foi recategorizado automaticamente por esta implementação.

O gate principal de produtos permanece separado: a migration `20260816210000_produtos_identidade_tecnica_v1.sql` continua dependendo de apply explícito em produção.

## ORÇAMENTO — EXCLUSÃO AUDITÁVEL DE ANEXOS E REENVIO — PR #156

A PR #156 já foi mergeada no commit `9a6cbb024cdc6aca9e7fe2faee8d14acb1adac69`.

Não voltar a excluir anexos de orçamento com `filter/splice` ou removendo o arquivo do Storage. O comportamento esperado é soft delete com motivo obrigatório e trilha de auditoria, preservando acesso de consulta ao arquivo.

Anexos com `excluido_em` não devem ser reenviados nem incluídos em novos envios. O campo de WhatsApp do vendedor deve permanecer disponível também no orçamento finalizado para reenvio.

Essa melhoria é independente do gate da migration de identidade técnica de produtos, que continua exigindo apply explícito em produção.

## PRODUTOS — IDENTIDADE TÉCNICA APLICADA E CARGA UN PREPARADA — 2026-08-17

O gate da identidade técnica foi concluído: `20260816210000_produtos_identidade_tecnica_v1.sql` foi aplicada em produção no run #79 (ID `32037239260`). Não voltar a tratá-la como pendente.

Tarefa atual: validar por PR/dry-run `20260817141000_carga_acessorios_wvetro_un_v1.sql`, com **649 acessórios faltantes cuja unidade de origem é UN**. A PR não autoriza apply automático em produção. Após dry-run verde, exigir autorização explícita antes do novo `apply`.

Os **136 faltantes com MT/PR/BR/PC/CJ/TB/M2/CT/RO** permanecem pendentes. Não definir `produtos.unidade` nem fator de conversão para eles sem validação operacional.

## PRODUTOS — UNIDADE OPERACIONAL PENDENTE — 2026-08-17

Checkpoint mais recente:
1. concluir PR desta modelagem e validar build + teste SQL;
2. depois executar um único `Supabase Database Control` na `main`, modo `apply`, confirmação `APPLY_PRODUCTION`;
3. o apply deverá executar a carga 649 `UN`, a alteração nullable de unidade e a carga 136 pendente;
4. validar no banco 785 novos acessórios reconciliados;
5. reconciliar a proveniência dos 389 acessórios já existentes, sem mudar `produtos.unidade` nos 93 divergentes;
6. avançar para perfis somente com a fonte real.

## GATE ATUAL — PERFIS W.VETRO / PROVENIÊNCIA — 2026-08-17

A auditoria dos 1.307 perfis está concluída e a migration de proveniência está preparada/testada em banco efêmero, mas **não está aplicada em produção**.

Migration:
`supabase/migrations/20260817170000_reconciliar_proveniencia_perfis_wvetro_v1.sql`

Estado:
- 1.307 perfis da fonte = 1.307 perfis Atlas; 0 faltantes e 0 exclusivos;
- migration sem INSERT e sem overwrite operacional;
- SHA-256 `cc34865fdcd6e7856e13608ba13b065f2630f57c89e6079720027d385bd4a3cf`;
- validação integral em PostgreSQL efêmero aprovada no run `32048680317`;
- produção acessada somente em `READ ONLY`;
- tamanho/NCM/fabricante suspeitos continuam não promovidos.

Próximos passos obrigatórios:
1. concluir/mergear a PR de auditoria #162 somente com checks exigidos verdes;
2. abrir/validar PR separada da migration;
3. exigir dry-run oficial do `Supabase Database Control`;
4. mergear somente com Build Validation + Vercel + controle de migration verdes;
5. depois do merge, solicitar autorização explícita para esta migration específica antes de `APPLY_PRODUCTION`;
6. após apply, verificar run/log e pós-estado antes de documentar como ativo.

Não interpretar `pode continuar` como autorização para apply em produção.

## Frente ativa — Home Operacional

A Home Operacional V1 está em `feat/home-operacional-v1` e deve passar pelos gates normais antes do merge.

Depois da V1, criar uma implementação separada para colaboração e comunicação, sem atalhos de schema:
1. registrar solicitante/atribuidor da tarefa e auditoria de atribuição antes de permitir tarefa formal para outro usuário;
2. criar notificações persistentes com estado lido/não lido e vínculo ao objeto de origem;
3. preferências por usuário para categorias de alerta e som;
4. alertas sonoros somente com configuração/consentimento adequado do navegador;
5. chat direto e chat contextual (orçamento/obra/tarefa) com participantes e histórico;
6. estudar sincronização de agenda externa (Google/Outlook) sem substituir a agenda operacional do Atlas.

Não declarar nenhum desses itens da fase seguinte como implementado até existir código/schema real e checks verdes.
