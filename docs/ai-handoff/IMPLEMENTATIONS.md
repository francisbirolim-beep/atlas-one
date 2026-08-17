# IMPLEMENTATIONS.md — Atlas One

Resumo cronológico das implementações relevantes. Para estado operacional usar `CURRENT_STATE.md`; para a próxima tarefa usar `NEXT_TASK.md`.

## Base funcional
- cadastros;
- clientes;
- Kanban de orçamentos;
- Orçamento Rápido/Balcão;
- tipologias dinâmicas;
- automações;
- controle Master/funcionário.

## Infraestrutura Supabase / migrations — 2026-08-11
- Session Pooler IPv4;
- audit/dry-run em PR;
- histórico local/remoto reconciliado;
- migrations operacionais controladas;
- workflow `Supabase Database Control` com apply manual.

## Medição Final V2 — PRs #54 a #56
- responsável e estados operacionais;
- checklist por peça/tipologia/seção;
- fotos categorizadas;
- link externo seguro;
- conclusão para revisão.

## Redesign / operação — PRs #57 a #73
- Home executiva;
- Sidebar;
- Kanban Comercial;
- Medição Final;
- Produção;
- Engenharia Fases 1 a 4;
- liberação idempotente para Produção.

## Kanban / trena / W.Vetro — PRs #104 a #118 — 2026-08-13/14
- fotos de campo;
- identificação LARGURA/ALTURA;
- leitura de trena/laser por IA;
- correção Baixo/Cima;
- anexo W.Vetro original;
- leitura automática de total;
- importação W.Vetro em Nova Medição;
- suporte a PDF W.Vetro sem dimensões;
- correções de parser, cliente e cidade.

## Medição Final — PRs #119 a #125
- 3 larguras + 3 alturas fixas por peça;
- foto da trena de largura e altura;
- CONTRAMARCO, ARREMATE, CADEIRINHA, CANTONEIRA SIM/NÃO;
- observação por peça;
- lembrete de vista interna;
- ordem mobile consolidada;
- medição parcial;
- cronômetro ativo;
- histórico de pausa/retomada;
- status FEITA/EM ABERTO;
- `/producao/medicao-final` confirmada como única Medição Final oficial.

## Mobile / Home — PRs #123 a #127
- Favoritos no mobile;
- Voltar e Início nas telas internas;
- limpeza da Home;
- Hero + Favoritos + Resumo da operação.

## PR #129 — navegação, orçamento/PDF e Plano de Corte V1
Mergeada em `main`.

- navegação diária simplificada;
- administração separada para Master;
- configurações de orçamento/PDF;
- `/producao/plano-corte`;
- snapshot persistente/editável;
- permissões seguindo Produção.

## PR #130 — arquitetura real do Plano de Corte
Mergeada em `main`.

- base técnica da Porta de Correr 03 Folhas Suprema;
- receitas específicas por produto com fallback por tipologia;
- parser de fórmulas restrito sem `eval`/`new Function`;
- decisão consolidada: produto cadastrado + receita mestre + variáveis + snapshot editável.

## Variáveis declarativas e variantes — PR #138
Mergeada em `main`.

- catálogo de variáveis/opções;
- vínculo por tipologia;
- variantes condicionais de componente;
- presets;
- resolução declarativa sem `eval`.

## W.Vetro — extração histórica inicial — 2026-08-16
Extração pontual de dados reais da API W.Vetro:
- 1.038 vendas/orçamentos analisados;
- 109 tipologias novas;
- 871 produtos importados;
- 479 perfis;
- 392 acessórios;
- produtos históricos importados com `preco = 0` como placeholder;
- API documentada em `docs/ai-handoff/WVETRO_API_MAPPING.md`.

Essa extração é histórica/pontual e não substitui uma integração permanente server-side.

## Materiais / linhas / cores — PRs #134 a #140
- tabelas de linhas e cores;
- preço do kg do alumínio;
- `linha_id` e `cor_id` em produtos;
- cadastro de materiais;
- selects de linha/cor em produto;
- precificação em lote;
- custo de pintura e adicional por kg por cor;
- seed de cores W.Vetro.

## Cadastro / navegação — PRs #141 e #142
- Cadastro no menu desktop/mobile;
- busca global também encontra páginas administrativas.

## PR #144 — correção de histórico da migration `setor_cadastro_v1`
- divergência era apenas de timestamp/nome do arquivo local;
- conteúdo SQL confirmado idêntico ao aplicado;
- rename para `20260816204749_setor_cadastro_v1.sql`;
- sem alteração de schema/dados;
- dry-run voltou a ficar limpo.

## PR #143 — identidade técnica de Produto — mergeada
Merge em `main` em 2026-08-17 01:55:49 UTC.

Commit de merge:
`bc08fe6443e41475497d8c1947f840236dc00762`

Implementado no código/schema proposto:
- `codigo`;
- `codigo_origem`;
- `origem`;
- `id_externo_wvetro`;
- `peso_kg_m`;
- `tamanho_barra_mm`;
- `tamanho_barra_mm_origem`;
- `dados_origem jsonb`;
- `status_validacao` e auditoria;
- `ncm_origem`/`ncm_status`;
- `produto_linhas` N:N;
- unique index parcial de código;
- busca por código/nome/descrição;
- badge de código técnico.

Migration:
`supabase/migrations/20260816210000_produtos_identidade_tecnica_v1.sql`

Estado de produção: **migration ainda não aplicada**.

## Auditoria pré-PR #143
Base do banco na época:
- 1.700 produtos;
- 1.405 OK;
- 14 ATENÇÃO;
- 281 REVISAR;
- 0 duplicidade de código.

Relatório:
`docs/tecnico/auditoria-produtos-2026-08-16.md`

## Auditoria da base completa `ExportWWAcessorios.xlsx` — 2026-08-16
Fonte completa analisada sem alterar o banco:
- 1.174 acessórios;
- 1.174 códigos preenchidos;
- 1.174 códigos únicos;
- 0 códigos duplicados;
- 36 descrições repetidas, 96 linhas envolvidas;
- 955 com Linha `GERAL`;
- 891 com Cor Única numérica (`15` em todos esses casos);
- 156 NCM `0`;
- 65 NCM `12345678`;
- 20 outros NCM fora do formato de 8 dígitos;
- sem descrições/unidades/linhas ausentes;
- todos ativos.

Relatório técnico:
`docs/tecnico/auditoria-exportwwacessorios-2026-08-16.md`

Script somente leitura:
`scripts/export-acessorios-atlas-reconciliacao.sql`

## PR #146 — handoff pós-PR #143 e preparação da reconciliação
Mergeada em `main`.

Commit de merge:
`f629f3598ef06b6e15e909752c2b461a3396ff07`

- atualizou `CURRENT_STATE.md`, `NEXT_TASK.md` e `IMPLEMENTATIONS.md`;
- registrou a auditoria da fonte completa;
- adicionou o script de export somente leitura dos 392 acessórios atuais;
- manteve bloqueada qualquer importação antes da reconciliação item a item.

## PR #147 — export seguro, reconciliação completa e correção de proveniência/unidade — mergeada
Mergeada em `main` em 2026-08-17.

Commit de merge:
`dee7af37b0bc31a024988b456e039a5beefd5cdd`

Implementado/documentado:
- workflow `Export Accessories Reconciliation`;
- execução somente manual (`workflow_dispatch`);
- sessão PostgreSQL forçada a `default_transaction_read_only=on`;
- artifact temporário com o export atual do Atlas;
- export executado com sucesso: **392 acessórios**;
- relatório `docs/tecnico/reconciliacao-exportwwacessorios-2026-08-16.md`.

Resultado da reconciliação por código técnico normalizado:
- fonte: 1.174;
- Atlas: 392;
- códigos em ambos: 389;
- `EXISTENTE_IGUAL`: 296;
- `EXISTENTE_DIVERGENTE`: 93;
- `FALTANTE_ATLAS`: 785;
- `DUPLICADO_ORIGEM`: 0;
- `SEM_CODIGO`: 0;
- somente no Atlas: 3 (`TELA-1000-GALV`, `TELA-132`, `TELA-254`).

As 93 divergências reais são exclusivamente de unidade:
- MT -> UN: 66;
- PR -> UN: 12;
- TB -> UN: 9;
- BR -> UN: 3;
- PT -> UN: 2;
- PC -> UN: 1.

Não houve divergência de descrição, NCM válido/seguro ou ativo entre códigos correspondentes.

### Descoberta de semântica de unidade

A fonte possui `Qtde Emb.`. Entre os divergentes há PT com 121/89, PC com 8 e MT com ocorrências 50/1. Isso torna inseguro copiar a unidade da origem diretamente para `produtos.unidade`.

O código confirmou que `produtos.unidade` é operacional: a tela de Engenharia copia essa unidade para o componente da receita quando um produto é selecionado.

### Correção preventiva da migration ainda não aplicada

A migration `20260816210000_produtos_identidade_tecnica_v1.sql` foi corrigida antes de qualquer apply:
- adiciona `unidade_origem`;
- adiciona `qtde_embalagem_origem`;
- mantém `produtos.unidade` como unidade operacional existente;
- não usa `UN` legado como falso valor de origem;
- usa `origem = legado` nos produtos técnicos preexistentes até reconciliação;
- salva `dados_origem` legado com `snapshot_tipo = atlas_legacy_pre_reconciliacao`;
- não classifica automaticamente todo `CODIGO - DESCRICAO` como origem W.Vetro;
- não cria falso `id_externo_wvetro`.

`lib/produtos.ts` foi expandido para aceitar os dois novos campos de origem em futuras cargas reconciliadas.

Checks antes do merge:
- Supabase Database Control / dry-run: success;
- Build Validation: success;
- Vercel: success;
- apply em produção: não executado.

Nenhum `INSERT`, `UPDATE`, `DELETE` de dados de produto ou migration foi executado em produção nessa etapa.

## PR #148 — filtro por Linha em Cadastro > Produtos — mergeada
Mergeada em `main` em 2026-08-17.

Commit de merge:
`9427c57b794d3116a68cf6401d8542b2ac9e88af`

Implementado:
- select de Linha acima da busca textual em `Cadastro > Produtos`;
- opção padrão `Todas as linhas`;
- filtro por `linha_id` combinado com busca por código/nome/descrição;
- sem alteração de schema/banco.

## Próxima etapa

O próximo gate exige decisão explícita:
1. decidir se aplica `20260816210000_produtos_identidade_tecnica_v1.sql` em produção;
2. se aprovado, executar somente via `Supabase Database Control` com `APPLY_PRODUCTION`;
3. confirmar que o schema foi realmente aplicado;
4. com schema ativo, preparar carga dos 785 faltantes seguros em PR separada;
5. preencher `unidade_origem`/`qtde_embalagem_origem` a partir da fonte real sem sobrescrever silenciosamente `produtos.unidade`;
6. validar os 93 divergentes segundo uso operacional, Compras, Estoque e Engenharia;
7. reauditar;
8. avançar para os 1.307 perfis de `ExportWWPerfil (1).xlsx`.

## Regras permanentes
- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- branch -> PR -> checks verdes -> merge manual;
- migration só conta como ativa após apply confirmado;
- não inventar NCM, linha, cor, preço, custo, medida, unidade operacional, fator de conversão ou identificador externo;
- `GERAL`, códigos numéricos de cor, unidade da fonte e Qtde Emb. permanecem dados de origem até validação de sua semântica;
- integração W.Vetro permanente deve ser server-side, sem credenciais no browser/frontend.

## ORÇAMENTO — HISTÓRICO DE VERSÕES — PR #150

Mergeada em 2026-08-17.

Commit de merge:
`2e983943fab550f7e32d0adeff0806a3dae2458c`

- versionamento sequencial dos PDFs gerados no Editar orçamento;
- data/hora registrada no título de cada nova versão;
- preservação das versões anteriores;
- legado sem timestamp individual marcado como data anterior não registrada;
- reenvio individual registrado no histórico;
- envio novo por WhatsApp exclui PDFs Atlas de versões anteriores;
- sem migration/schema change.

## ORÇAMENTO FINALIZADO — ANEXO PERMANENTE — PR #152

Mergeada em 2026-08-17 no commit `a7679d9bd103a56e838d1e4376232c65d0e9f75a`.

- corrigido desaparecimento do botão/campo de anexo após finalização do orçamento;
- adicionada área permanente para nova revisão em orçamento finalizado;
- upload finalizado persiste imediatamente no JSON de anexos;
- histórico e anexos anteriores preservados;
- inclusão registrada no histórico;
- sem migration/schema change.

## CADASTRO — CATEGORIAS DINÂMICAS DE PRODUTOS — PR #154

Mergeada em 2026-08-17 no commit `a4ae49e58ddd6317e903dfee1e032a8b8694a5f4`.

- categorias de produto passaram de lista fixa para configuração dinâmica;
- Cadastro exibe Produto, Acessório, Perfil e Produto pronto separadamente;
- botão Nova categoria permite expansão sem código/migration;
- categorias customizadas são armazenadas em `configuracoes_gerais`;
- tela Produtos abre filtrada pela categoria escolhida e mantém filtro por linha/busca;
- categorias legadas e produtos existentes são preservados sem movimentação automática;
- sem migration/schema change.
