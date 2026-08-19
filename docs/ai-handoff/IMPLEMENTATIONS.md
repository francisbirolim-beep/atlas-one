# IMPLEMENTATIONS.md — Atlas One

## 2026-08-19 — PR #196 — edição de configuração validada existente

Merge em `main`: `e9f6fd2cff93a74d85ad98f00e5f64532fe92cf0`.

Implementado sem migration:
- atualização autenticada de preset existente via `PUT /api/engenharia/configuracoes-orcamento`;
- helper client `atualizarConfiguracaoValidadaOrcamento`;
- botão `Editar` na tela `Engenharia > Configurações validadas`;
- pré-carregamento de nome, evidência, valores, produto e imagem;
- troca/remoção de imagem no mesmo registro;
- linha/tipologia bloqueadas durante edição para preservar identidade técnica;
- duplicate check exclui o próprio ID;
- metadados de validação são renovados no UPDATE e `criado_por_*` é preservado.

Gates: Build Validation #281 e Vercel Preview verdes.

## 2026-08-19 — PR #197 — correção auditada PC3 Suprema cadastrada como JC3

Merge em `main`: `46a22f4527b60f2bd6da90089f6bb4f018bfa3f5`.

Fonte exata: print W.Vetro do Francis mostrando `L. SUPREMA → PORTA DE CORRER 03 FOLHAS` e projetos `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`.

Migration preparada: `20260819062000_corrigir_pc3_suprema_cadastro_v1.sql`.

A migration:
- identifica somente os 4 projetos por código normalizado exato;
- exige 4 alvos distintos e aborta em conflito;
- move os presets da tipologia errada Janela 03 para a tipologia exata `l_suprema_porta_de_correr_03_folhas`;
- corrige JC3 → PC3 conforme o print;
- limpa `valores` para `{}` porque a composição anterior foi inferida incorretamente;
- acrescenta evidência auditada;
- remove somente os vínculos `composicao_folha_N` criados sem evidência nas janelas Suprema 02/03/04/06;
- mantém as variáveis/opções globais disponíveis para futura remodelagem;
- contém pós-checks de contagem/estado final.

Gates do head final:
- Build Validation #282: **success**;
- Vercel Preview: **success**;
- Supabase Database Control #104: **success em dry-run**;
- apply de produção: **não executado**.

### Estado operacional

A migration da PR #197 está mergeada, mas **não aplicada em produção**. O banco ainda não deve ser tratado como corrigido até apply explícito e pós-check confirmado.

### Lição técnica

Não usar `composicao_folha_N = vidro|persiana|tela` como verdade universal. O desenho PC3-02-EF comprova composição vertical mista dentro de um painel; portanto a modelagem precisa ser revista antes de replicar presets para outras tipologias.
