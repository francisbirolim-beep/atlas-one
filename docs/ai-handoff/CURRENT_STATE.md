# CURRENT_STATE.md — Atlas One

## EM VALIDAÇÃO — VISUAL PC3 NO SELETOR — 2026-08-19

Branch `feat/pc3-imagens-grid-4` adiciona os quatro desenhos recortados do print W.Vetro confirmado para `SUPREMA → PORTA DE CORRER 03 FOLHAS` e os associa no seletor por correspondência **exata** do nome do preset:
- `*SUCB-PC3-01EF` → `/configuracoes/pc3/SUCB-PC3-01EF.png`;
- `*SUCB-PC3-02-EF` → `/configuracoes/pc3/SUCB-PC3-02-EF.png`;
- `*SUCB-PC3-03-EF` → `/configuracoes/pc3/SUCB-PC3-03-EF.png`;
- `*SUCB-PC3-04-EF` → `/configuracoes/pc3/SUCB-PC3-04-EF.png`.

`imagem_url` continua sendo a fonte prioritária quando existir. O desenho estático é fallback auditado somente para esses quatro códigos, sem fuzzy e sem alterar banco. O grid do orçamento passa a usar 4 colunas em desktop (`lg:grid-cols-4`). Não há migration nesta branch.

## ESTADO AUTORITATIVO — PC3 SUPREMA CORRIGIDO EM PRODUÇÃO — 2026-08-19

### Evidência W.Vetro confirmada

O print real compartilhado pelo Francis mostra explicitamente:
- Linha: `L. SUPREMA`;
- Modelo: `PORTA DE CORRER 03 FOLHAS`;
- projetos: `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`.

O cadastro anterior como `Janela de Correr 03 Folhas / JC3` estava incorreto. Também tinham sido gravados valores `composicao_folha_N` inferidos visualmente e não sustentados pela evidência real.

### PR #196 — edição de preset existente — CONCLUÍDA

PR #196 foi mergeada em `main` no commit `e9f6fd2cff93a74d85ad98f00e5f64532fe92cf0`, com Build Validation e Vercel verdes, sem migration.

Implementado:
- editar uma configuração validada já existente sem criar duplicata;
- `PUT /api/engenharia/configuracoes-orcamento`, Master-only;
- pré-carregar nome, evidência, valores, produto e imagem;
- trocar/remover imagem no mesmo preset;
- linha e tipologia ficam bloqueadas na edição para preservar identidade técnica;
- checagem de duplicidade ignora o próprio ID;
- criação/ativação continuam separadas.

### PR #197 + PR #200 — correção PC3/JC3 — APLICADA EM PRODUÇÃO

PR #197 introduziu a migration `supabase/migrations/20260819062000_corrigir_pc3_suprema_cadastro_v1.sql`.

O primeiro apply autorizado foi bloqueado com segurança antes de qualquer alteração: o gate original comparava o nome inteiro normalizado do preset com o código puro e encontrou 0 alvos. Auditoria read-only do banco confirmou que existiam exatamente 4 presets, com nomes descritivos contendo os códigos `*SUCB-JC3-01EF` a `04EF`.

PR #200 corrigiu apenas esse gate para detectar a sequência exata do código dentro do nome normalizado, sem fuzzy/semelhança. Gates da PR #200: Build Validation verde, Vercel Preview verde e Supabase Database Control dry-run verde.

Com autorização explícita do Francis, o segundo apply foi executado pela operação temporária da PR #201. Antes do write, a fila completa foi auditada novamente e continha exatamente uma migration pendente: `20260819062000_corrigir_pc3_suprema_cadastro_v1.sql`. O apply terminou com sucesso e o histórico remoto confirmou `20260819062000 | 20260819062000`. A PR #201 foi fechada sem merge, portanto seu workflow temporário não entrou na `main`.

### Estado final confirmado pela própria migration

A transação só conclui se todos os pós-checks passarem. O estado autoritativo em produção é:
- exatamente 4 presets sob `l_suprema_porta_de_correr_03_folhas`;
- nomes exatos:
  - `*SUCB-PC3-01EF`;
  - `*SUCB-PC3-02-EF`;
  - `*SUCB-PC3-03-EF`;
  - `*SUCB-PC3-04-EF`;
- zero desses alvos permanece em `l_suprema_janela_de_correr_03_folhas`;
- `valores = {}` nos 4 presets, removendo a composição inferida anteriormente;
- zero vínculos `composicao_folha_1..6` nas tipologias L. Suprema > Janela de Correr 02/03/04/06 folhas;
- as variáveis/opções globais `composicao_folha_N` permanecem no catálogo para futura remodelagem correta;
- imagens não foram alteradas pela migration.

### Imagens dos quatro PC3

Os desenhos foram recortados novamente do print original do W.Vetro. A branch visual atual os mantém como ativos estáticos auditados para os quatro códigos exatos; a edição da PR #196 continua disponível para substituir o fallback por `imagem_url` persistida quando desejado.

### Arquitetura de composição — decisão atual

Não replicar a modelagem `composicao_folha_N = vidro|persiana|tela` para novas tipologias com base apenas no print. Os projetos W.Vetro podem possuir subdivisões/composições dentro de um mesmo painel/folha. A próxima modelagem precisa representar a configuração visual real sem inventar semântica técnica.

### Governança permanente

- GitHub é a única fonte da verdade;
- nunca commitar direto em `main`;
- branch → PR → Build Validation verde → merge;
- migration só conta como ativa após apply confirmado;
- qualquer apply exige autorização explícita e específica do Francis;
- antes do apply, auditar a fila completa de migrations pendentes;
- nunca inferir tipologia, composição, receita, perfil, acessório, fórmula ou vínculo por semelhança de nome;
- a imagem/desenho de configuração é evidência visual; não reinterpretar automaticamente seu conteúdo como receita técnica.
