# NEXT_TASK.md — Atlas One

> O snapshot completo anterior foi preservado em `docs/ai-handoff/archive/2026-08-18-pre-pr183-NEXT_TASK.md`.

## GATE ATUAL — aplicar composição por folha / imagem de configuração

PR #183 já está mergeada em `main` no commit `f89c82855218438669911246105c6c2ebc879825`. Build Validation #256 e Vercel passaram; Supabase Database Control #102 passou somente em dry-run e confirmou que o apply foi pulado.

Migration pendente:
`supabase/migrations/20260818210500_configuracoes_composicao_folhas_imagem_v1.sql`

### Próximo passo — exige autorização explícita do Francis

Antes de qualquer apply:
1. listar/dry-run **toda** a fila de migrations pendentes;
2. registrar exatamente quais arquivos serão aplicados em conjunto — o workflow não é seletivo por migration;
3. pedir/confirmar autorização explícita específica do Francis;
4. somente então executar `Supabase Database Control` em `main`, `mode=apply`, `confirmation=APPLY_PRODUCTION`.

### Pós-apply obrigatório

Confirmar no banco real:
- coluna `engenharia_variaveis_preset.imagem_url` existente;
- 6 variáveis `composicao_folha_1..6`;
- 18 opções (`vidro`, `persiana`, `tela` para cada posição);
- pelo menos 15 vínculos de composição nas tipologias L. Suprema > Janela de Correr 02/03/04/06 folhas;
- nenhum preset/configuração criado automaticamente pela migration.

### Depois do banco ativo

Cadastrar manualmente configurações reais em `Engenharia > Configurações validadas`:
- escolher Linha/Tipologia;
- preencher somente variáveis comprovadas;
- registrar evidência técnica;
- subir manualmente o desenho técnico/foto da configuração;
- validar/liberar somente configurações realmente conferidas.

Primeira validação recomendada:
`SUPREMA → JANELA DE CORRER 03 FOLHAS`

Criar alguns cards reais com composições comprovadas de `vidro/persiana/tela` por posição e confirmar no orçamento que:
- a imagem da configuração aparece primeiro;
- foto do produto continua fallback;
- somente presets `validado=true`, `usar_no_orcamento=true` e `ativo=true` aparecem;
- a seleção carrega o snapshot das variáveis da configuração.

## Regras que continuam obrigatórias

- GitHub é a única fonte da verdade;
- nunca commitar direto em `main`;
- branch → PR → Build Validation verde → merge;
- não aplicar migration sem autorização explícita;
- não inventar composição, imagem, receita, perfil, acessório, unidade, NCM, fórmula ou vínculo por semelhança de nome;
- desenho técnico desta frente é upload manual por configuração.

## Fila secundária preservada

Fora deste gate, continuam pendentes de validação humana os 136 acessórios com unidade operacional `NULL`. Não inferir unidade/fator de conversão a partir de `unidade_origem` ou `qtde_embalagem_origem`.
