# IMPLEMENTATIONS.md — Atlas One

## 2026-08-19 — visual PC3 auditado + grid de 4 cards — EM VALIDAÇÃO

Branch `feat/pc3-imagens-grid-4`.

Implementado sem migration e sem alteração de banco:
- adicionados quatro ativos estáticos em `public/configuracoes/pc3/`, recortados do print W.Vetro confirmado;
- resolução estrita por nome exato dos presets `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`;
- `config.imagem_url` permanece com prioridade sobre o fallback estático;
- `produto.foto_url` permanece como fallback posterior;
- nenhum nome semelhante ou outro preset recebe imagem automaticamente;
- grid das configurações no orçamento alterado de 3 para 4 colunas em desktop (`lg:grid-cols-4`).

Documento de evidência: `docs/ai-handoff/PC3_VISUAL_20260819.md`.

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

Gates: Build Validation e Vercel Preview verdes.

## 2026-08-19 — PR #197 / #200 — correção auditada PC3 Suprema

Fonte exata: print W.Vetro do Francis mostrando `L. SUPREMA → PORTA DE CORRER 03 FOLHAS` e projetos `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`.

Migration: `20260819062000_corrigir_pc3_suprema_cadastro_v1.sql`.

A correção:
- trabalha somente com as chaves exatas `l_suprema_janela_de_correr_03_folhas` e `l_suprema_porta_de_correr_03_folhas`;
- identifica os quatro presets pela sequência exata do código normalizado contida no nome, sem fuzzy;
- exige exatamente 4 registros e 4 códigos distintos;
- aborta se houver ambiguidade ou o mesmo código em outra tipologia;
- move os 4 presets para `l_suprema_porta_de_correr_03_folhas`;
- renomeia para `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`;
- limpa `valores` para `{}` porque a composição anterior foi inferida incorretamente;
- acrescenta evidência auditada da correção;
- remove somente os vínculos `composicao_folha_N` das janelas Suprema 02/03/04/06;
- mantém as variáveis/opções globais para futura remodelagem;
- não cria preset, receita, produto, preço, fórmula ou imagem.

### Primeira tentativa de apply — bloqueada com segurança

Com autorização explícita do Francis, uma primeira operação temporária foi iniciada pela PR #199. A fila de migrations estava correta e continha apenas `20260819062000_corrigir_pc3_suprema_cadastro_v1.sql`, mas o gate da migration encontrou 0 alvos e abortou antes de qualquer alteração.

Auditoria read-only confirmou os 4 registros reais e a causa: os nomes eram descritivos, como `JC3 — vidro + vidro + vidro (*SUCB-JC3-01EF)`, enquanto o gate comparava o nome inteiro normalizado ao código puro.

PR #200 corrigiu o gate. Build Validation, Vercel e Supabase dry-run passaram.

### Segundo apply — CONCLUÍDO

A PR operacional temporária #201 foi criada em Draft e não foi mergeada. Build Validation e Vercel passaram. Ao sair de Draft, o workflow:
1. auditou o histórico remoto;
2. executou dry-run da fila completa;
3. confirmou exatamente uma pendência, `20260819062000_corrigir_pc3_suprema_cadastro_v1.sql`;
4. executou o apply;
5. confirmou no histórico remoto `20260819062000 | 20260819062000`.

A migration concluiu com sucesso, portanto seus pós-checks transacionais também passaram. A PR #201 foi fechada sem merge, mantendo o workflow temporário fora da `main`.

### Estado final de produção

- 4 presets PC3 em `l_suprema_porta_de_correr_03_folhas`;
- 0 alvos PC3/JC3 em `l_suprema_janela_de_correr_03_folhas`;
- `valores = {}` nos 4 presets;
- 0 vínculos `composicao_folha_N` nas janelas Suprema 02/03/04/06;
- variáveis/opções globais preservadas;
- imagens não alteradas pela migration.

### Lição técnica

Não usar `composicao_folha_N = vidro|persiana|tela` como verdade universal. O desenho PC3-02-EF mostra composição vertical mista dentro do painel; portanto a modelagem precisa ser revista antes de replicar valores estruturados para outras tipologias.
