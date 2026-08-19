# CURRENT_STATE.md — Atlas One

## ESTADO AUTORITATIVO — COMPOSIÇÃO DE FOLHA / IMAGEM DE CONFIGURAÇÃO — APLICADO EM PRODUÇÃO — 2026-08-18

> Esta seção supera a seção "CONFIGURAÇÕES VISUAIS / COMPOSIÇÃO POR FOLHA — 2026-08-18" logo abaixo (mantida como histórico, já superada).

### Migration aplicada em produção

A migration `supabase/migrations/20260818210500_configuracoes_composicao_folhas_imagem_v1.sql` foi aplicada em produção via `Supabase Database Control` (`mode=apply`, `confirmation=APPLY_PRODUCTION`), com autorização explícita do Francis. A fila de migrations pendentes foi auditada antes do apply: essa era a única migration pendente.

Pós-estado confirmado direto no banco (leitura via Supabase MCP, após o apply):
- `engenharia_variaveis_preset.imagem_url`: coluna existe;
- variáveis `composicao_folha_1` a `composicao_folha_6`: 6 confirmadas;
- opções `vidro`/`persiana`/`tela` por posição: 18 confirmadas;
- vínculos em `engenharia_tipologia_variaveis` para L. Suprema > Janela de Correr 02/03/04/06 folhas: 15 confirmados;
- `engenharia_variaveis_preset`: 0 linhas — nenhuma configuração real foi criada pela migration, como esperado (gates internos da própria migration também validaram essas contagens em transação).

### O que falta agora é cadastro humano, não código

O schema está pronto e ativo, mas vazio de configuração real. Para os cards aparecerem no seletor de orçamento (grade Linha → Modelo → Configuração com desenho técnico, no estilo do sistema W.Vetro que o Francis mostrou), é necessário cadastrar manualmente em `Engenharia > Configurações validadas`:
1. escolher Linha = L. Suprema, Tipologia = Janela De Correr 03 Folhas (primeira validação recomendada);
2. preencher a composição real de cada folha (vidro/persiana/tela), só com combinações tecnicamente comprovadas;
3. registrar evidência técnica da validação;
4. subir manualmente o desenho técnico/foto da configuração (upload, sem geração automática);
5. confirmar que o preset fica `validado=true`, `usar_no_orcamento=true`, `ativo=true` para aparecer no orçamento.

Não inventar composição, imagem ou vínculo por semelhança de nome.

## ESTADO AUTORITATIVO — CONFIGURAÇÕES VISUAIS / COMPOSIÇÃO POR FOLHA — 2026-08-18 (histórico, já superado pela seção acima)

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

### Estado do banco — importante (histórico, na época desta seção)

Na época em que esta seção foi escrita, a migration ainda **não estava aplicada em produção**. Isso já mudou — ver seção autoritativa no topo do arquivo.

### Estado técnico anterior que continua válido

A migration `20260818020000_linha_tipologias_produtos_biblioteca_tecnica_v1.sql` já foi aplicada em produção no Supabase Database Control run #100, com autorização explícita. Pós-estado confirmado na época:
- `linha_tipologias`: 46;
- `linha_produtos`: 8;
- `SUPREMA → Porta de Correr 03 Folhas` presente.

O mesmo run #100 também aplicou a migration anterior de configurações validadas porque o workflow aplica **todas as migrations pendentes em ordem cronológica**. Esta é uma regra operacional permanente: antes de qualquer novo apply, auditar a fila completa de migrations pendentes; nunca presumir apply seletivo por arquivo.

A reconciliação dos acessórios e dos 1.307 perfis W.Vetro está concluída em produção conforme o snapshot histórico arquivado. Os 136 acessórios cuja unidade operacional permanece `NULL` continuam pendentes de validação humana; não inferir unidade ou fator de conversão.

### Governança permanente

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- fluxo obrigatório: branch → PR → Build Validation verde → merge;
- migration só conta como ativa depois de apply confirmado;
- nunca inventar dado, vínculo, composição, receita, perfil, acessório, unidade, NCM ou fórmula por semelhança de nome;
- desenhos técnicos desta frente são upload manual por configuração; não gerar automaticamente nesta etapa.
