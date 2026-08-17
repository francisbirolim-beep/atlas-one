# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositório GitHub é a única fonte da verdade. Antes de alterar código, verificar o estado real do repositório. Ao concluir implementação relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em 2026-08-17.

## ESTADO REAL DA MAIN

PR #147 — **mergeada**.

Commit de merge:
`dee7af37b0bc31a024988b456e039a5beefd5cdd`

Conteúdo principal:
- reconciliação completa dos acessórios W.Vetro x Atlas;
- workflow de exportação somente leitura;
- correção preventiva da migration de identidade técnica;
- separação entre unidade operacional e unidade de origem;
- `unidade_origem` e `qtde_embalagem_origem` preparados no schema proposto;
- proveniência de registros preexistentes corrigida para `legado` até reconciliação real.

PR #148 — **mergeada**.

Commit de merge:
`9427c57b794d3116a68cf6401d8542b2ac9e88af`

Conteúdo:
- filtro por Linha na tela `Cadastro > Produtos`;
- combinado com a busca textual existente;
- sem alteração de schema/banco.

## RECONCILIAÇÃO DOS ACESSÓRIOS — CONCLUÍDA

Fonte W.Vetro:
- 1.174 acessórios.

Atlas atual:
- 392 acessórios.

Resultado:
- códigos encontrados nos dois lados: **389**;
- `EXISTENTE_IGUAL`: **296**;
- `EXISTENTE_DIVERGENTE`: **93**;
- `FALTANTE_ATLAS`: **785**;
- `DUPLICADO_ORIGEM`: **0**;
- `SEM_CODIGO`: **0**;
- itens existentes somente no Atlas: **3**.

Itens somente no Atlas:
- `TELA-1000-GALV`;
- `TELA-132`;
- `TELA-254`.

Não apagar automaticamente.

Relatório:
`docs/tecnico/reconciliacao-exportwwacessorios-2026-08-16.md`

## DIVERGÊNCIAS REAIS

As 93 divergências encontradas são exclusivamente de unidade:
- MT -> UN: 66;
- PR -> UN: 12;
- TB -> UN: 9;
- BR -> UN: 3;
- PT -> UN: 2;
- PC -> UN: 1.

Não houve divergência de descrição, NCM válido/seguro ou status ativo entre códigos correspondentes.

A fonte também possui `Qtde Emb.`; sua semântica não deve ser inventada.

## DECISÃO DE MODELAGEM DE UNIDADE

`produtos.unidade` continua sendo a unidade operacional/canônica usada pelo Atlas.

A fonte externa deve ser preservada separadamente:
- `unidade_origem`;
- `qtde_embalagem_origem`.

Não sobrescrever `produtos.unidade` automaticamente.

O motivo é operacional: Engenharia copia `produto.unidade` para a unidade do componente ao selecionar um produto em receita.

## IDENTIDADE TÉCNICA — MIGRATION MERGEADA, MAS NÃO APLICADA

Migration:
`supabase/migrations/20260816210000_produtos_identidade_tecnica_v1.sql`

Estado: **ainda não aplicada em produção**.

Ela passou em dry-run antes do merge.

A versão corrigida:
- adiciona `unidade_origem`;
- adiciona `qtde_embalagem_origem`;
- mantém `produtos.unidade` operacional;
- não usa `UN` legado como falso valor de origem;
- classifica produtos técnicos preexistentes como `origem = legado` até reconciliação real;
- identifica snapshot legado como `atlas_legacy_pre_reconciliacao`;
- não usa código técnico como falso `id_externo_wvetro`.

Só considerar os novos campos/tabela ativos depois de apply confirmado via `Supabase Database Control`.

## BASE W.VETRO EXISTENTE NO ATLAS

Extração histórica registrada:
- 1.038 vendas/orçamentos analisados;
- 109 tipologias novas;
- 871 produtos importados;
- 479 perfis;
- 392 acessórios;
- preço dos 392 acessórios atuais permanece `0` como placeholder histórico;
- unidade atual dos 392 acessórios está `UN`, mas 93 correspondências têm unidade diferente na fonte.

## QUALIDADE DA FONTE W.VETRO

`ExportWWAcessorios.xlsx`:
- 1.174 códigos preenchidos e únicos;
- 0 duplicados;
- 955 com `Linha = GERAL`;
- 891 com Cor Única numérica;
- 156 NCM `0`;
- 65 NCM `12345678`;
- 20 outros NCM fora do formato de 8 dígitos;
- todos ativos.

Esses valores de origem não devem ser automaticamente tratados como dados técnicos validados.

## PRÓXIMO GATE

O próximo passo exige decisão explícita:
1. aplicar ou não `20260816210000_produtos_identidade_tecnica_v1.sql` em produção;
2. se aprovado, executar `Supabase Database Control` com modo `apply` e confirmação `APPLY_PRODUCTION`;
3. confirmar a aplicação real;
4. só depois preparar PR separada para carga dos 785 acessórios faltantes seguros;
5. tratar os 93 divergentes sem sobrescrita silenciosa;
6. reauditar;
7. depois avançar para os 1.307 perfis de `ExportWWPerfil (1).xlsx`.

## PLANO DE CORTE / ENGENHARIA

Decisões preservadas:
- produto cadastrado é a entrada do Plano de Corte;
- receita específica por produto tem prioridade;
- receita genérica da tipologia é fallback;
- snapshot do plano não altera receita mestre;
- fórmula não validada não inventa corte;
- variantes devem ser declarativas, sem `eval`.

## MEDIÇÃO FINAL OFICIAL

Rota:
`/producao/medicao-final`

Ordem por peça:
1. identificação;
2. fotos de trena largura/altura;
3. largura baixo/meio/cima;
4. altura direita/meio/esquerda;
5. contramarco/arremate/cadeirinha/cantoneira SIM/NÃO;
6. observação;
7. campos configuráveis;
8. fotos adicionais.

## CUIDADOS PERMANENTES

- nunca commitar direto na `main`;
- branch -> PR -> checks verdes -> merge manual;
- migration só é considerada ativa após apply confirmado;
- não usar `migration repair --reverted` sem diagnóstico explícito;
- não inventar medidas, fórmulas, NCM, linha, cor, unidade, fator de conversão ou identificador externo;
- credenciais W.Vetro nunca ficam no frontend/browser em integração permanente.

## ORÇAMENTO — HISTÓRICO DE VERSÕES — PR #150

PR #150 — **mergeada** em 2026-08-17.

Commit de merge:
`2e983943fab550f7e32d0adeff0806a3dae2458c`

Implementado na tela de Editar orçamento:
- PDFs do Atlas passam a receber numeração sequencial: Versão 01, 02, 03...;
- cada nova versão registra data e hora no próprio título exibido no histórico de anexos;
- versões anteriores permanecem preservadas;
- PDFs legados sem timestamp individual são identificados como `data anterior não registrada`, sem inventar data;
- o botão de reenviar versão/anexo continua disponível e o reenvio passa a ser registrado no histórico do orçamento;
- ao enviar uma nova versão pelo WhatsApp, PDFs Atlas de versões anteriores não são incluídos novamente na mensagem;
- a área de anexos em elaboração passou a se chamar `Anexos e histórico de versões`.

Sem migration e sem alteração de schema/banco.

## ORÇAMENTO FINALIZADO — ANEXO PERMANENTE — PR #152

PR #152 — **mergeada** em 2026-08-17.

Commit de merge:
`a7679d9bd103a56e838d1e4376232c65d0e9f75a`

Correção ativa em `Editar orçamento`:
- orçamento já finalizado continua exibindo o histórico de anexos e `Reenviar`;
- passa a exibir também, de forma permanente, `Anexar novo orçamento / revisão`;
- novo anexo em orçamento finalizado é persistido imediatamente em `orcamentos.anexos`;
- anexos anteriores são preservados;
- o card e o modal são atualizados na mesma sessão;
- a inclusão do novo arquivo é registrada no histórico do orçamento.

Sem migration e sem alteração de schema.

## CADASTRO — CATEGORIAS DINÂMICAS DE PRODUTOS — PR #154

PR #154 — **mergeada** em 2026-08-17.

Commit de merge:
`a4ae49e58ddd6317e903dfee1e032a8b8694a5f4`

Estado ativo:
- a tela principal `Cadastro` mostra as categorias de produto diretamente, em vez de um único acesso genérico a Produtos;
- categorias principais: `Produto`, `Acessório`, `Perfil` e `Produto pronto`;
- o usuário master pode criar outras categorias pelo botão `Nova categoria`;
- categorias personalizadas são persistidas em `configuracoes_gerais`;
- clicar numa categoria abre `/cadastro/produtos` já filtrado por ela;
- cadastro e edição de produtos usam a lista dinâmica de categorias;
- categorias legadas já usadas por produtos são preservadas e continuam aparecendo, sem recategorização automática;
- filtro por Linha continua combinado com categoria e busca textual.

Sem migration e sem alteração de schema: `produtos.categoria` já é texto livre.

## ORÇAMENTO — EXCLUSÃO AUDITÁVEL DE ANEXOS E REENVIO — PR #156

PR #156 — **mergeada** em 2026-08-17.

Commit de merge:
`9a6cbb024cdc6aca9e7fe2faee8d14acb1adac69`

Estado ativo em `Editar orçamento`:
- anexos não são apagados fisicamente quando o usuário escolhe Excluir;
- a exclusão é lógica e exige motivo obrigatório;
- o JSON do anexo preserva `excluido_em`, `excluido_por_id`, `excluido_por_nome` e `motivo_exclusao`;
- a exclusão também é registrada em `historico_orcamento` via helper existente;
- anexo excluído permanece visível em vermelho/riscado e o arquivo continua podendo ser aberto para auditoria;
- anexo excluído não pode ser reenviado e é removido de futuros conjuntos de envio;
- versões excluídas continuam contando no histórico, portanto números de versão não são reutilizados;
- orçamento finalizado passa a exibir o campo WhatsApp do vendedor e a mensagem antes do reenvio, preenchendo o número cadastrado quando disponível e permitindo alteração manual;
- a mesma exclusão lógica/auditável vale durante a elaboração.

Sem migration e sem alteração de schema: os metadados adicionais usam o JSON existente em `orcamentos.anexos`.
