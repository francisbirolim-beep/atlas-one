# CURRENT_STATE.md — Atlas One

## ESTADO AUTORITATIVO — CADASTRO REAL: L. SUPREMA > JANELA DE CORRER 03 FOLHAS — 2026-08-18

> Esta seção supera a seção "COMPOSIÇÃO DE FOLHA / IMAGEM DE CONFIGURAÇÃO — APLICADO EM PRODUÇÃO — 2026-08-18" logo abaixo (mantida como histórico).

4 configurações reais foram cadastradas em produção em `Engenharia > Configurações validadas`, para a tipologia `l_suprema_janela_de_correr_03_folhas`, com base no sistema W.Vetro real (print de tela compartilhado pelo Francis, códigos `*SUCB-JC3-01EF` a `04EF`):

- **01EF** — folha 1/2/3 = vidro/vidro/vidro;
- **02EF** — folha 1/2/3 = persiana/persiana/persiana;
- **03EF** — folha 1/2 = persiana/vidro, folha 3 deixada em branco de propósito: o desenho técnico deste código mostra só 2 painéis, apesar do agrupamento "03 folhas" do W.Vetro — não inventado, sinalizado na evidência para revisão humana;
- **04EF** — folha 1/2 = vidro/tela, mesma ressalva de 2 painéis que o 03EF.

Todos os 4 presets: `validado=true`, `ativo=true`, `usar_no_orcamento=true`, com `evidencia_validacao` citando o código W.Vetro e o arquivo de origem do print. Confirmado direto no banco (Supabase MCP, leitura) após o cadastro: 4 linhas em `engenharia_variaveis_preset` para essa tipologia, valores conferem exatamente com a lista acima.

### Pendência — upload manual das imagens

As 4 imagens já foram recortadas do print original do Francis (`card_01EF.png` a `card_04EF.png`, entregues a ele nesta sessão) mas `imagem_url` de todos os 4 presets está `null`: a ferramenta de upload de arquivo do navegador usada nesta sessão só aceita arquivos explicitamente compartilhados com a sessão, e a pasta de outputs local não estava nessa lista. Francis pode subir as 4 imagens manualmente em `Engenharia > Configurações validadas` (editar cada configuração e usar "Selecionar imagem"). Sem imagem, o card do orçamento cai no fallback `produto.foto_url`, que também está vazio para esses presets (nenhum produto base vinculado ainda) — então por enquanto os cards aparecem sem foto até o upload manual.

### Próximo passo sugerido

Validar visualmente no seletor de orçamento que os 4 cards aparecem corretamente (nome, evidência, e depois da imagem subida). Avaliar depois se replica o mesmo cadastro para as tipologias 02/04/06 folhas da L. Suprema e para outras linhas técnicas, sempre com evidência real do W.Vetro antes de estender — nunca por semelhança de nome.

## ESTADO AUTORITATIVO — COMPOSIÇÃO DE FOLHA / IMAGEM DE CONFIGURAÇÃO — APLICADO EM PRODUÇÃO — 2026-08-18 (histórico, já superado pela seção acima)

> Esta seção supera a seção "CONFIGURAÇÕES VISUAIS / COMPOSIÇÃO POR FOLHA — 2026-08-18" logo abaixo (mantida como histórico, já superada).

### Migration aplicada em produção

A migration `supabase/migrations/20260818210500_configuracoes_composicao_folhas_imagem_v1.sql` foi aplicada em produção via `Supabase Database Control` (`mode=apply`, `confirmation=APPLY_PRODUCTION`), com autorização explícita do Francis. A fila de migrations pendentes foi auditada antes do apply: essa era a única migration pendente.

Pós-estado confirmado direto no banco (leitura via Supabase MCP, após o apply):
- `engenharia_variaveis_preset.imagem_url`: coluna existe;
- variáveis `composicao_folha_1` a `composicao_folha_6`: 6 confirmadas;
- opções `vidro`/`persiana`/`tela` por posição: 18 confirmadas;
- vínculos em `engenharia_tipologia_variaveis` para L. Suprema > Janela de Correr 02/03/04/06 folhas: 15 confirmados;
- `engenharia_variaveis_preset`: 0 linhas — nenhuma configuração real foi criada pela migration, como esperado (gates internos da própria migration também validaram essas contagens em transação).

### O que faltava era cadastro humano, não código (histórico — já feito, ver seção autoritativa no topo)

O schema estava pronto e ativo. Para os cards aparecerem no seletor de orçamento (grade Linha → Modelo → Configuração com desenho técnico, no estilo do sistema W.Vetro que o Francis mostrou), era necessário cadastrar manualmente em `Engenharia > Configurações validadas` — isso já foi feito para L. Suprema > Janela De Correr 03 Folhas, ver seção autoritativa no topo deste arquivo.

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
- `engenharia_variaveis_preset` passa a suportar `imagem_url` somente após o apply da migration;
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

Na época em que esta seção foi escrita, a migration ainda não estava aplicada em produção. Isso já mudou — ver seção autoritativa no topo do arquivo.

### Estado técnico anterior que continua válido

A migration `20260818020000_linha_tipologias_produtos_biblioteca_tecnica_v1.sql` já foi aplicada em produção no Supabase Database Control run #100, com autorização explícita. Pós-estado confirmado na época:
- `linha_tipologias`: 46;
- `linha_produtos`: 8;
- `SUPREMA → Porta de Correr 03 Folhas` presente.

O mesmo run #100 também aplicou a migration anterior de configurações validadas porque o workflow aplica todas as migrations pendentes em ordem cronológica. Esta é uma regra operacional permanente: antes de qualquer novo apply, auditar a fila completa de migrations pendentes; nunca presumir apply seletivo por arquivo.

A reconciliação dos acessórios e dos 1.307 perfis W.Vetro está concluída em produção conforme o snapshot histórico arquivado. Os 136 acessórios cuja unidade operacional permanece NULL continuam pendentes de validação humana; não inferir unidade ou fator de conversão.

### Governança permanente

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- fluxo obrigatório: branch → PR → Build Validation verde → merge;
- migration só conta como ativa depois de apply confirmado;
- nunca inventar dado, vínculo, composição, receita, perfil, acessório, unidade, NCM ou fórmula por semelhança de nome;
- desenhos técnicos desta frente são upload manual por configuração; não gerar automaticamente nesta etapa.
