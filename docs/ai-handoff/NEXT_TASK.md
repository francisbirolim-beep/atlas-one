# NEXT_TASK.md — Atlas One

> O snapshot completo anterior foi preservado em `docs/ai-handoff/archive/2026-08-18-pre-pr183-NEXT_TASK.md`.

## TAREFA ATUAL — cadastrar configurações reais de composição de folha (L. Suprema)

A migration `20260818210500_configuracoes_composicao_folhas_imagem_v1.sql` foi **APLICADA EM PRODUÇÃO em 2026-08-18**, com autorização explícita do Francis, após auditoria da fila completa de migrations pendentes (só essa estava pendente).

Pós-estado confirmado direto no banco:
- coluna `engenharia_variaveis_preset.imagem_url` ativa;
- 6 variáveis `composicao_folha_1` a `composicao_folha_6`;
- 18 opções (`vidro`/`persiana`/`tela` por posição);
- 15 vínculos em `engenharia_tipologia_variaveis` para L. Suprema > Janela de Correr 02/03/04/06 folhas;
- 0 linhas em `engenharia_variaveis_preset` — nenhuma configuração real foi criada automaticamente.

### Próximo passo — cadastro humano, não código

Em `Engenharia > Configurações validadas`:
1. escolher Linha = L. Suprema, Tipologia = Janela De Correr 03 Folhas (primeira validação recomendada, com base no modelo real do sistema W.Vetro compartilhado pelo Francis);
2. preencher a composição real de cada folha (vidro/persiana/tela) só com combinações tecnicamente comprovadas;
3. registrar evidência técnica da validação;
4. subir manualmente o desenho técnico/foto da configuração (upload, sem geração automática);
5. confirmar no seletor de orçamento que o card aparece com a imagem certa (produto.foto_url só como fallback) e que somente presets `validado=true`, `usar_no_orcamento=true` e `ativo=true` aparecem.

Não inventar composição, código ou vínculo por semelhança de nome. Depois de validar o caso da Janela De Correr 03 Folhas, avaliar se replica para 02/04/06 folhas e para as demais linhas técnicas (GOLD, LINHA 30, etc.), sempre com evidência real antes de estender.

## Regras que continuam obrigatórias

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`; branch → PR → Build Validation verde → merge;
- nunca aplicar migration em produção sem autorização explícita e específica do Francis;
- antes de qualquer apply, auditar a fila **completa** de migrations pendentes — o workflow aplica tudo de uma vez, não é seletivo por arquivo;
- nunca inventar dado, vínculo, composição, receita, perfil, acessório, unidade, NCM ou fórmula por semelhança de nome;
- ao final de qualquer implementação relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md com o estado real.

## Fila secundária preservada

Fora deste gate, continuam pendentes de validação humana os 136 acessórios com unidade operacional `NULL`. Não inferir unidade/fator de conversão a partir de `unidade_origem` ou `qtde_embalagem_origem`.
