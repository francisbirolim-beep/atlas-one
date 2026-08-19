# CURRENT_STATE.md — Atlas One

## ESTADO AUTORITATIVO — CORREÇÃO PC3 SUPREMA PREPARADA, APPLY PENDENTE — 2026-08-19

> O snapshot completo imediatamente anterior a esta correção foi preservado em `docs/ai-handoff/archive/2026-08-19-pre-pc3-correction-CURRENT_STATE.md`.

### Evidência W.Vetro corrigida

O print real compartilhado pelo Francis mostra explicitamente:
- Linha: `L. SUPREMA`;
- Modelo: `PORTA DE CORRER 03 FOLHAS`;
- projetos: `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`.

Portanto, o cadastro/documentação anterior como `Janela de Correr 03 Folhas / JC3` está incorreto. Também foram inferidos valores `composicao_folha_N` que não são sustentados pelo desenho real; o projeto 02EF, por exemplo, possui composição vertical mista dentro dos painéis, o que não cabe no modelo simples `vidro|persiana|tela` por folha.

### PR #196 — edição de preset existente — CONCLUÍDA

PR #196 foi mergeada em `main` no commit `e9f6fd2cff93a74d85ad98f00e5f64532fe92cf0`, com Build Validation e Vercel verdes, sem migration.

Implementado:
- editar uma configuração validada já existente sem criar duplicata;
- `PUT /api/engenharia/configuracoes-orcamento`, Master-only;
- pré-carregar nome, evidência, valores, produto e imagem;
- trocar/remover imagem no mesmo preset;
- linha e tipologia ficam bloqueadas na edição para preservar a identidade técnica;
- checagem de duplicidade ignora o próprio ID;
- criação/ativação continuam separadas.

### PR #197 — correção PC3/JC3 — MERGEADA, NÃO APLICADA

PR #197 foi mergeada em `main` no commit `46a22f4527b60f2bd6da90089f6bb4f018bfa3f5`.

Migration pendente: `supabase/migrations/20260819062000_corrigir_pc3_suprema_cadastro_v1.sql`.

Gates do head final da PR #197:
- Build Validation #282: **success**;
- Vercel Preview: **success**;
- Supabase Database Control #104: **success em dry-run**;
- confirmação de produção: **skipped**;
- apply: **skipped**.

A migration, se autorizada/aplicada, foi preparada para:
1. exigir exatamente os quatro presets alvo, por código normalizado exato;
2. mover os quatro de `l_suprema_janela_de_correr_03_folhas` para `l_suprema_porta_de_correr_03_folhas`;
3. corrigir os nomes para os códigos PC3 do print;
4. limpar `valores` para `{}` em vez de substituir uma inferência errada por outra;
5. acrescentar evidência auditada da correção;
6. remover os vínculos `composicao_folha_1..6` criados sem evidência suficiente nas tipologias Suprema > Janela de Correr 02/03/04/06 folhas;
7. preservar variáveis/opções globais para futura remodelagem;
8. não criar presets, receitas, produtos, preços, fórmulas ou imagens.

### Estado REAL de produção neste momento

A migration corretiva **ainda não foi aplicada**. Portanto o banco de produção ainda deve ser tratado como contendo os quatro presets no cadastro anterior incorreto (Janela/JC3) e os vínculos de composição nas janelas, até existir apply confirmado.

Não declarar PC3 corrigido em produção antes desse apply.

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
- a imagem/desenho de configuração é evidência visual e upload manual; não reinterpretar automaticamente seu conteúdo como receita técnica.
