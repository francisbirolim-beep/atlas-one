# CURRENT_STATE.md — Atlas One

## ESTADO AUTORITATIVO — CONFIGURAÇÕES VISUAIS / COMPOSIÇÃO POR FOLHA — 2026-08-18

> O snapshot histórico completo anterior a esta atualização foi preservado em `docs/ai-handoff/archive/2026-08-18-pre-pr183-CURRENT_STATE.md`.

### PR #183 — mergeada e publicada

PR #183 (`feat: composição de folhas e imagem nas configurações`) foi mergeada em `main` no commit `f89c82855218438669911246105c6c2ebc879825`.

Validações do head final:
- Build Validation #256: **success**;
- Vercel Preview: **success**;
- Supabase Database Control #102: **success em dry-run**;
- `Require explicit production confirmation`: **skipped**;
- `Apply pending migrations`: **skipped**.

O deploy da `main` referente ao commit `f89c82855218438669911246105c6c2ebc879825` também foi confirmado como **success** no Vercel.

### Código implementado

- nova migration `supabase/migrations/20260818210500_configuracoes_composicao_folhas_imagem_v1.sql`;
- `engenharia_variaveis_preset` passa a suportar `imagem_url` **somente após o apply da migration**;
- variáveis declarativas propostas `composicao_folha_1` até `composicao_folha_6`;
- opções por posição: `vidro`, `persiana`, `tela`;
- vínculos propostos, por `tipologias.chave` exata e sem UUID fixo, apenas para L. Suprema > Janela de Correr 02/03/04/06 folhas;
- 02 folhas recebe folha 1..2; 03 recebe 1..3; 04 recebe 1..4; 06 recebe 1..6;
- vínculos entram com `obrigatorio = false`;
- `lib/upload.ts` possui `uploadImagemConfiguracao(file)` usando o helper existente `subirComTentativas('configuracoes', file)`;
- Engenharia > Configurações validadas permite selecionar imagem, ver preview e enviar desenho técnico/foto manual da configuração;
- API aceita `imagemUrl` e só inclui `imagem_url` no INSERT quando uma imagem foi realmente fornecida, preservando o cadastro antigo antes do apply;
- cards do orçamento priorizam `config.imagem_url` e usam `produto.foto_url` somente como fallback;
- busca administrativa considera também variáveis estruturadas.

### Estado do banco — importante

A migration `20260818210500_configuracoes_composicao_folhas_imagem_v1.sql` está **MERGEADA, MAS NÃO APLICADA EM PRODUÇÃO**.

Portanto, até autorização explícita do Francis e apply confirmado:
- a coluna `imagem_url` ainda não deve ser considerada ativa no banco;
- as 6 variáveis de composição ainda não devem ser consideradas ativas;
- as 18 opções ainda não devem ser consideradas ativas;
- os 15 vínculos esperados de composição ainda não devem ser considerados ativos.

Nenhuma configuração/preset real foi criada, validada ou liberada automaticamente pela PR #183.

### Estado técnico anterior que continua válido

A migration `20260818020000_linha_tipologias_produtos_biblioteca_tecnica_v1.sql` já foi aplicada em produção no Supabase Database Control run #100, com autorização explícita. Pós-estado confirmado na época:
- `linha_tipologias`: 46;
- `linha_produtos`: 8;
- `SUPREMA → Porta de Correr 03 Folhas` presente.

O mesmo run #100 também aplicou a migration anterior de configurações validadas porque o workflow aplica **todas as migrations pendentes em ordem cronológica**. Esta é uma regra operacional permanente: antes de qualquer novo apply, auditar a fila completa de migrations pendentes; nunca presumir apply seletivo por arquivo.

A reconciliação dos acessórios e dos 1.307 perfis W.Vetro está concluída em produção conforme o snapshot histórico arquivado. Os 136 acessórios cuja unidade operacional permanece `NULL` continuam pendentes de validação humana; não inferir unidade ou fator de conversão.

### Próximo gate

O próximo passo desta frente exige autorização explícita do Francis para apply em produção. Antes disso:
1. listar/dry-run de **toda** a fila pendente;
2. confirmar exatamente quais migrations serão aplicadas junto;
3. somente após autorização específica executar `mode=apply` + `APPLY_PRODUCTION`;
4. confirmar pós-estado da coluna, variáveis, opções e vínculos;
5. depois cadastrar manualmente configurações reais com evidência técnica e imagem;
6. primeira validação funcional recomendada: `SUPREMA → JANELA DE CORRER 03 FOLHAS`, com combinações reais de vidro/persiana/tela por posição.

### Governança permanente

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- fluxo obrigatório: branch → PR → Build Validation verde → merge;
- migration só conta como ativa depois de apply confirmado;
- nunca inventar dado, vínculo, composição, receita, perfil, acessório, unidade, NCM ou fórmula por semelhança de nome;
- desenhos técnicos desta frente são upload manual por configuração; não gerar automaticamente nesta etapa.
