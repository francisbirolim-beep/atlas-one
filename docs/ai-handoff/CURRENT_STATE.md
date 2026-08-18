# CURRENT_STATE.md — Atlas One

## LINHA_TIPOLOGIAS E LINHA_PRODUTOS — PR #180 MERGEADA; APPLY PENDENTE — 2026-08-18

PR #180 mergeada em `main`, merge commit `e1bc573`.

Contexto: `linhas_tecnicas` já tinha 5 linhas (SUPREMA, GOLD, LINHA 30, PELE DE VIDRO/FACHADA ATLANTA, REVESTIMENTO RIPADO), mas `linha_tipologias` e `linha_produtos` estavam com 0 registros, fazendo o seletor de orçamento (`components/orcamento/SeletorEsquadriaInteligente.tsx`) mostrar "Nenhum modelo disponível" para qualquer linha selecionada, incluindo SUPREMA -> Porta de Correr 03 Folhas.

Migration `supabase/migrations/20260818020000_linha_tipologias_produtos_biblioteca_tecnica_v1.sql`, idempotente (`ON CONFLICT DO NOTHING`, sem UPDATE/DELETE), popula:
- `linha_tipologias`: +46 pares (SUPREMA 23, GOLD 17, LINHA 30 5, PELE DE VIDRO/FACHADA ATLANTA 1), usando match exato entre o token "(Linha)" no final de `tipologias.label` e `linhas_tecnicas.nome`/`apelidos`;
- `linha_produtos`: +8 pares (SUPREMA 2, GOLD 1, FACHADA ATLANTA 5), usando `produtos.dados_origem->>'linha_raw'` (campo real da fonte W.Vetro `ExportWWAcessorios.xlsx`), também com igualdade exata, sem semelhança de nome.

Relatório completo: `docs/tecnico/carga-linha-tipologias-produtos-2026-08-18.md`.

Build Validation e Supabase Database Control (dry-run, run #99, sucesso em 21s, acionado via `pull_request`) verdes antes do merge.

Estado: **migration mergeada em `main`, mas NÃO aplicada em produção**. `linha_tipologias` e `linha_produtos` continuam com 0 linhas no banco real até apply confirmado via `Supabase Database Control` com `APPLY_PRODUCTION`.

Pendências fora do escopo desta PR, aguardando decisão humana:
- REVESTIMENTO_RIPADO: apelidos cadastrados (`"RIPADO"`/`"REVESTIMENTO RIPADO"`) não batem exatamente com o token `"Ripados"` (plural) usado nas tipologias da fonte;
- os 1.307 perfis (`ExportWWPerfil`) não têm campo de Linha na fonte original, só `fabricante_raw` (marca) e nome livre — vincular por nome seria semelhança de nome, proibido pela regra do usuário;
- 1 acessório com `dados_origem->>'linha_raw' = "GOLD - LINHA GOLD"` (não é match exato de nenhum apelido cadastrado de GOLD).

Confirmado nesta auditoria: não existe integração/API viva do W.Vetro configurada no repositório ou no ambiente. Toda a base W.Vetro em produção vem de dois exports manuais já importados e reconciliados (`ExportWWPerfil (1)(1).xlsx`, `ExportWWAcessorios.xlsx`). Resolve a pendência histórica sobre a limitação de credenciais W.Vetro.

Achado à parte, não alterado nesta tarefa: RLS continua desabilitado em `engenharia_conferencias`, `engenharia_receitas` e `engenharia_receita_componentes`.

Nota de estado da main (não auditado em detalhe por esta tarefa): PRs #177, #178 e #179 também estão mergeadas em `main`, cobrindo uma frente de UI de cadastro por linha e seletor de orçamento por linha/modelo/projeto (`app/cadastro/produtos/por-linha/`, `components/orcamento/SeletorEsquadriaInteligente.tsx`). Antes de reimplementar qualquer coisa nessa área, ler o código atual dessas rotas.

## PERFIS W.VETRO — PRODUÇÃO CONCLUÍDA — 2026-08-17

A reconciliação de proveniência dos **1.307 perfis W.Vetro** está concluída em produção. Não voltar a tratar `20260817170000_reconciliar_proveniencia_perfis_wvetro_v1.sql` como pendente.

Apply confirmado pelo `Supabase Database Control` run **#86** (ID `32059852704`), branch `main`, commit `0b4b4a145f89bd3ad52626cd23335fb7bef2043e`, com `CONFIRMATION: APPLY_PRODUCTION`, log `Applying migration 20260817170000_reconciliar_proveniencia_perfis_wvetro_v1.sql...` e `Finished supabase db push.`.

Estado consolidado:
- fonte W.Vetro: 1.307 perfis;
- Atlas: 1.307 perfis;
- 1.307 códigos correspondentes;
- 0 faltantes e 0 exclusivos Atlas;
- 1.235 correspondências iguais;
- 72 valores de fonte deliberadamente não promovidos por qualidade;
- 0 divergência operacional real;
- nenhum INSERT de perfil e nenhuma sobrescrita de nome, preço/custo, unidade operacional, peso, NCM operacional, marca, ativo, linha, cor ou ID externo.

Os valores crus permanecem preservados em campos de origem. `Tamanho` da fonte não foi promovido automaticamente para tamanho operacional; NCM/fabricante suspeitos continuam pendentes conforme regras de qualidade.

Os blocos abaixo que dizem que esta migration ainda está pendente são históricos e não devem orientar nova ação.


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
- não inventar vínculo Linha -> Tipologia/Produto por semelhança de nome; usar apenas fonte W.Vetro rastreável (LinhaId/LinhaNome, ou campos crus preservados em `dados_origem`);
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

## PRODUTOS — PROVENIÊNCIA DOS PERFIS W.VETRO PREPARADA E TESTADA — 2026-08-17

A migration `20260817170000_reconciliar_proveniencia_perfis_wvetro_v1.sql` está preparada, mas **NÃO aplicada em produção**.

Escopo:
- reconcilia somente os 1.307 perfis W.Vetro já existentes no Atlas;
- não insere produtos;
- altera apenas `codigo_origem`, `origem`, `unidade_origem`, `tamanho_barra_mm_origem`, `ncm_origem`, `dados_origem` e `updated_at`;
- todos os demais campos são congelados e comparados antes/depois dentro da própria transação;
- `tamanho_barra_mm` operacional permanece sem promoção automática;
- os 4 `NCM = 16` e os 68 `Nome Fabricante = 16` permanecem somente como dados crus de origem, sem promover NCM/marca operacional.

Proteções:
- Gate 1 exige exatamente 1.307 perfis e o hash canônico do snapshot Atlas auditado;
- Gate 2 reconstrói a fonte W.Vetro com 249 exceções explícitas e exige o hash canônico da planilha auditada;
- os dois hashes usam `COLLATE "C"` para ordenação determinística independente da locale do PostgreSQL;
- a migration aborta se qualquer campo operacional/protegido mudar.

SHA-256 da migration preparada: `cc34865fdcd6e7856e13608ba13b065f2630f57c89e6079720027d385bd4a3cf`.

Validação completa executada fora da produção no run `32048680317`:
- snapshot atual de produção exportado em transação `READ ONLY`: 1.307 perfis;
- snapshot antigo x atual comparado: 0 diferenças nos campos auditados;
- migration executada integralmente em PostgreSQL 16 efêmero;
- log: `UPDATE 1307`;
- todos os pós-checks passaram e a transação efêmera terminou em `COMMIT`;
- verificação final: 1.307 perfis com `origem = wvetro`, 1.307 tamanhos de origem preenchidos e 0 tamanhos promovidos para `tamanho_barra_mm`.

Uma primeira execução efêmera foi corretamente bloqueada por diferença de collation na ordenação do hash. A investigação comprovou 0 drift de dados; a correção foi somente tornar os dois `ORDER BY` dos hashes determinísticos com `COLLATE "C"`.

Próximo gate: PR da migration + dry-run oficial. Apply em produção exige autorização explícita específica e confirmação `APPLY_PRODUCTION`.

## PRODUTOS — PERFIS W.VETRO MERGEADOS; APPLY PENDENTE — 2026-08-17

Estado mais recente, que substitui os gates antigos desta seção:
- PR consolidada **#163** foi mergeada em `main`;
- merge commit: `0b4b4a145f89bd3ad52626cd23335fb7bef2043e`;
- a antiga PR #162 foi fechada como substituída, sem mergear seu preview Vercel vermelho;
- o conjunto consolidado da #163 passou Build Validation, Vercel Preview e Supabase Database Control dry-run antes do merge;
- dry-run oficial: run #85 / ID `32049150791`;
- única migration pendente detectada: `20260817170000_reconciliar_proveniencia_perfis_wvetro_v1.sql`;
- log oficial confirmou `DRY RUN: migrations will *not* be pushed to the database.`;
- etapas de confirmação e apply ficaram `skipped`;
- nenhum run de `Supabase Database Control` posterior ao #85 apareceu após o merge, portanto a migration **continua NÃO aplicada em produção**.

O preview Vercel da #163 foi `success`. O deploy de produção do merge commit foi recusado por `build-rate-limit`; esta PR não altera código executável do app, apenas documentação, export read-only e arquivo de migration. Não confundir falha de quota de deploy com falha de build da implementação.

Próximo gate de banco: obter autorização explícita específica do usuário para aplicar `20260817170000_reconciliar_proveniencia_perfis_wvetro_v1.sql` e só então executar `Supabase Database Control` em `main` com `mode=apply` e confirmação `APPLY_PRODUCTION`.

## HOME OPERACIONAL V1 — implementação em validação (2026-08-17)

Branch: `feat/home-operacional-v1`.

Direção funcional aprovada pelo usuário: a Home passa a ser a central diária do Atlas, com tarefas, agenda/calendário, alertas e indicadores operacionais.

Implementado nesta V1 sem migration:
- Hero simplificado; removido o botão duplicado `Novo orçamento` de dentro do Hero; o `+ Novo` do Topbar continua sendo a entrada de orçamento rápido.
- Ações rápidas `Nova tarefa` e `Novo compromisso`.
- `Minhas tarefas` usa a tabela/helper existente `tarefas`; permite concluir e criar tarefa para o próprio usuário.
- `Agenda / Calendário` usa `eventos` + `evento_convidados`; mostra compromissos próprios/convites e permite criar compromisso convidando usuários já cadastrados.
- Alertas são derivados em tempo real de dados já existentes: tarefa vencida, tarefa para hoje, convite de agenda pendente e compromisso iniciando em até 60 minutos.
- Topbar ganhou sino com badge desses alertas operacionais. Nesta V1 não existe persistência de lido/não lido e não existe som.
- Indicadores inferiores usam critérios explícitos: orçamentos `rascunho/enviado`; medições ainda não `aprovado`; total de cards em `producao_itens`; tarefas vencidas do usuário logado.
- Não foi criada tabela de chat e não foi simulada atribuição de tarefas entre usuários. O schema atual de `tarefas` não registra solicitante; colaboração formal fica para migration/PR separada.

Próximo gate desta frente: PR -> Build Validation + Vercel verdes -> merge. Depois, em PR separada, desenhar colaboração auditável (solicitante/responsável), notificações persistentes, preferências de som, chat e posterior sincronização de agendas externas.

## COLABORAÇÃO + NOTIFICAÇÕES V1 — preparada em branch (2026-08-18)

Branch: `feat/colaboracao-notificacoes-v1`.

Auditoria read-only de produção confirmou:
- `tarefas` e `tarefa_colunas` ainda usavam `acesso_total_temporario` (`ALL using=true/check=true`);
- `eventos` e `evento_convidados` já possuíam RLS por dono/convidado.

Implementado na branch:
- migration `20260818013000_colaboracao_notificacoes_v1.sql`;
- `tarefas`: `solicitante_id`, `solicitante_nome`, `atribuida_em`, `prioridade`;
- substituição da RLS permissiva de `tarefas`/`tarefa_colunas` por policies do próprio usuário;
- API server-side autenticada `/api/tarefas/atribuir` para atribuição cross-user;
- criação automática das colunas padrão do responsável quando necessário;
- notificações persistentes por destinatário (`notificacoes`) com RLS própria;
- preferências por usuário (`notificacao_preferencias`), incluindo `som_ativo` e volume;
- Realtime para novas notificações;
- trigger tarefa atribuída -> notificação;
- trigger convite de agenda -> notificação;
- sino do Topbar lê notificações persistentes, marca lidas e permite ativar/desativar som;
- Home e tela `Minhas Tarefas` permitem escolher responsável; tarefa recebida mostra quem criou;
- tarefa recorrente atribuída para outro usuário permanece bloqueada nesta V1;
- automações de orçamento/assistência passaram a usar a API segura; existe fallback legado somente para a janela anterior ao apply da migration.

Validações já concluídas na branch:
- auditoria PostgreSQL READ ONLY registrada em `docs/tecnico/auditoria-rls-colaboracao-2026-08-17.md`;
- migration executada integralmente em PostgreSQL 16 efêmero; triggers de tarefa/agenda geraram exatamente uma notificação cada; RLS temporária removida no teste; Realtime confirmado;
- build Next.js completo verde após integração da UI.

A migration ainda NÃO foi aplicada em produção. Próximo gate: PR -> Build + Vercel + Supabase dry-run oficiais -> merge. Depois pedir autorização explícita específica antes de `APPLY_PRODUCTION`. Chat e sincronização externa de calendário continuam fora desta V1.

Nota: este branch já foi mergeado em `main` (a migration `20260818013000_colaboracao_notificacoes_v1.sql` está presente no repositório em 2026-08-18), mas não há confirmação de apply em produção registrada por esta tarefa. Confirmar estado real antes de assumir ativo.

## PRODUTOS — PAGINAÇÃO ACIMA DE 1.000 REGISTROS — PR #169 — 2026-08-18

Correção preparada para `listarProdutos()` após constatar que os 1.307 perfis continuavam preservados no banco, mas não apareciam em Cadastro > Perfil porque uma única consulta Supabase era truncada em 1.000 registros.

A correção pagina `produtos` em blocos de 1.000, acumula todas as páginas, mantém `somenteAtivos`, usa ordenação estável `categoria -> nome -> id` e retorna lista vazia em erro de qualquer página para não expor resultado parcial.

Sem migration, INSERT, UPDATE ou DELETE de produtos. Nenhum perfil foi reimportado ou alterado.
