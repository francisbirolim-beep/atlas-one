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

## PRODUTOS — IDENTIDADE TÉCNICA APLICADA E CARGA UN PREPARADA — 2026-08-17

A migration de identidade técnica `20260816210000_produtos_identidade_tecnica_v1.sql` está **ativa em produção**. Apply confirmado pelo `Supabase Database Control` run #79 (ID `32037239260`), com `APPLY_PRODUCTION`, etapa de apply concluída e log `Finished supabase db push.`.

Com isso, os campos de identidade/proveniência e `produto_linhas` passam a ser considerados ativos no banco.

Próxima carga preparada em PR separada: `20260817141000_carga_acessorios_wvetro_un_v1.sql`, contendo somente **649 dos 785 acessórios faltantes**, todos com unidade de origem `UN`. Os **136 não-UN** ficam fora até validação da unidade operacional.

A carga não inventa preço/custo, linha técnica, cor técnica, fator de conversão ou ID externo W.Vetro. Preço 0 permanece placeholder explícito por exigência do schema/fonte sem preço. NCM nunca é validado automaticamente.

## PRODUTOS — UNIDADE OPERACIONAL PENDENTE — 2026-08-17

A carga dos 649 acessórios com unidade de origem `UN` está mergeada na `main`, porém ainda não aplicada em produção.

Foi preparada a etapa dos 136 acessórios faltantes com unidade de origem MT/PR/BR/PC/CJ/TB/M2/CT/RO sem inferir conversão:
- `produtos.unidade` poderá ser `NULL`, significando unidade operacional ainda não definida;
- `unidade_origem` e `qtde_embalagem_origem` preservam a fonte;
- os 136 entram com `unidade = NULL` e `status_validacao = importado`;
- itens sem unidade operacional ficam fora de Engenharia, Plano de Corte, Orçamento Balcão, seleção de produto no Orçamento Rápido e contexto da IA Comercial;
- continuam visíveis em Cadastro, exibindo unidade de origem e Qtde Emb. para validação humana.

Migrations preparadas:
- `20260817150000_produtos_unidade_operacional_pendente_v1.sql`;
- `20260817151000_carga_acessorios_wvetro_unidade_pendente_v1.sql`.

Essas migrations só contam como ativas após apply confirmado no `Supabase Database Control`.

## PRODUTOS — ACESSÓRIOS W.VETRO — PRODUÇÃO CONCLUÍDA — 2026-08-17

A reconciliação/carga dos acessórios W.Vetro está concluída em produção. Não voltar a tratá-la como migration pendente.

Aplicações confirmadas pelo `Supabase Database Control`:
- run #82 (ID `32043969549`): aplicou `20260817141000_carga_acessorios_wvetro_un_v1.sql`, `20260817150000_produtos_unidade_operacional_pendente_v1.sql` e `20260817151000_carga_acessorios_wvetro_unidade_pendente_v1.sql`;
- run #84 (ID `32044325910`): aplicou `20260817160000_reconciliar_proveniencia_acessorios_wvetro_v1.sql`;
- ambos com confirmação explícita `APPLY_PRODUCTION` e `Finished supabase db push.`.

Estado consolidado:
- fonte W.Vetro: 1.174 acessórios;
- 785 acessórios faltantes foram adicionados ao Atlas;
- 649 desses 785 usam unidade operacional `UN`;
- 136 ficaram com `produtos.unidade = NULL`, preservando a unidade de origem e permanecendo fora dos fluxos operacionais que exigem unidade validada;
- 389 acessórios preexistentes receberam proveniência W.Vetro;
- 296 correspondências iguais foram confirmadas;
- 93 divergências de unidade foram preservadas sem sobrescrever `produtos.unidade`;
- os 3 itens exclusivos do Atlas (`TELA-1000-GALV`, `TELA-132`, `TELA-254`) permanecem preservados;
- total esperado da categoria acessório após a consolidação: 1.177 registros, sendo 1.174 ligados à fonte W.Vetro e 3 exclusivos do Atlas.

A migration final possui pós-checks transacionais que abortam se não houver 389 registros reconciliados, se a proveniência ficar incompleta, se algum campo operacional for alterado, se as 93 divergências não forem preservadas ou se as 296 correspondências iguais não forem confirmadas. O apply concluído confirma que essas guardas passaram.

PR final de proveniência:
- PR #160;
- merge commit `ec2a97fbf2f6c2accfe1cbcc7e4030527fd2ce1c`.

Pendência operacional remanescente, sem bloquear a base:
- validar humanamente a unidade operacional dos 136 acessórios com unidade de origem diferente de `UN`;
- não inferir conversão, unidade canônica ou `Qtde Emb.` automaticamente.

## PRODUTOS — PERFIS W.VETRO — RECONCILIAÇÃO CONCLUÍDA — 2026-08-17

Fonte real auditada: `ExportWWPerfil (1)(1).xlsx`.

Resultado da fonte:
- 1.307 linhas;
- 1.307 códigos preenchidos e únicos;
- 0 duplicados;
- todos ativos.

Snapshot atual do Atlas exportado em transação PostgreSQL explicitamente `READ ONLY` pelo run `32045643983`:
- 1.307 perfis;
- `transaction_read_only = on` confirmado antes do SELECT;
- nenhuma escrita executada.

Reconciliação por código técnico:
- presentes nos dois lados: **1.307**;
- faltantes no Atlas: **0**;
- somente no Atlas: **0**;
- `EXISTENTE_IGUAL`: **1.235**;
- `EXISTENTE_FONTE_NAO_PROMOVIDA`: **72**;
- divergência operacional real: **0**.

Os 72 casos de fonte não promovida são deliberados:
- 68 registros com `Nome Fabricante = 16` e marca operacional vazia;
- 4 registros com `NCM = 16` e NCM operacional vazio.

Qualidade da fonte que deve permanecer pendente/de origem:
- 221 NCM placeholders;
- 18 NCM em formato atípico;
- 7 tamanhos atípicos (`6` ou `60000`);
- 2 pesos acima de 50 (`0000000056 = 3462`, `0000000171 = 11538`);
- 68 fabricantes numéricos `16`;
- 61 campos `Cod.Barras` preenchidos;
- 83 valores de sucata não zero.

Decisão: **não inserir novos perfis**. A próxima migration deve apenas enriquecer a proveniência dos 1.307 registros já existentes, preservando integralmente os campos operacionais e mantendo `tamanho_barra_mm` sem promoção automática.

Relatório técnico:
`docs/tecnico/reconciliacao-exportwwperfil-2026-08-17.md`.
