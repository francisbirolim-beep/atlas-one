# NEXT_TASK.md — Atlas One

> O snapshot completo anterior foi preservado em `docs/ai-handoff/archive/2026-08-18-pre-pr183-NEXT_TASK.md`.
>
> ## CONCLUIDO — Catalogo por Linha com modelos clicaveis (2026-08-19)
>
> PR #194 foi mergeada em `main` (commit `da7c6df`): os modelos/tipologias na tela `Cadastro > Produtos > Catalogo por Linha` agora sao clicaveis e levam direto para `Engenharia > Configuracoes validadas` ja filtrado pela linha e tipologia, para todas as linhas cadastradas. Ver IMPLEMENTATIONS.md para detalhe.
>
> 

## TAREFA ATUAL — validar cards no seletor e decidir replicação

O cadastro humano de L. Suprema > Janela De Correr 03 Folhas está concluído: 4 configurações reais (`*SUCB-JC3-01EF` a `04EF`) publicadas em `Engenharia > Configurações validadas`, todas `validado=true`, `ativo=true`, `usar_no_orcamento=true`, com composição de folha e evidência técnica real (ver CURRENT_STATE.md e IMPLEMENTATIONS.md para o detalhe de cada uma).

### Pendências diretas

1. **Upload manual de 4 imagens.** `imagem_url` está `null` nos 4 presets. As imagens já recortadas (`card_01EF.png` a `card_04EF.png`) foram entregues ao Francis; falta ele subir cada uma em `Engenharia > Configurações validadas` (editar a configuração → "Selecionar imagem"). Sem isso, os cards caem no fallback `produto.foto_url`, que também está vazio (nenhum produto base vinculado).
2. **Validar visualmente no seletor de orçamento** (`SeletorEsquadriaInteligente`) que os 4 cards aparecem corretamente com nome e evidência, e depois com imagem após o upload manual.
3. **Revisar os casos 03EF/04EF**: só têm 2 folhas preenchidas (folha 3 em branco) porque o desenho técnico do W.Vetro para esses dois códigos mostra apenas 2 painéis, apesar do agrupamento "03 folhas". Isso está sinalizado na evidência técnica de cada um; vale uma checagem humana para confirmar se é uma peculiaridade real do modelo ou se falta uma variante.

### Depois disso

Avaliar se replica o mesmo cadastro para as tipologias 02/04/06 folhas da L. Suprema (já têm variáveis `composicao_folha_N` vinculadas, só falta preset real) e para outras linhas técnicas (GOLD, LINHA 30, etc.), sempre com evidência real do W.Vetro antes de estender — nunca por semelhança de nome ou código.

## Regras que continuam obrigatórias

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`; branch → PR → Build Validation verde → merge;
- nunca aplicar migration em produção sem autorização explícita e específica do Francis;
- antes de qualquer apply, auditar a fila **completa** de migrations pendentes — o workflow aplica tudo de uma vez, não é seletivo por arquivo;
- nunca inventar dado, vínculo, composição, receita, perfil, acessório, unidade, NCM ou fórmula por semelhança de nome;
- ao final de qualquer implementação relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md com o estado real.

## Fila secundária preservada

Fora deste gate, continuam pendentes de validação humana os 136 acessórios com unidade operacional `NULL`. Não inferir unidade/fator de conversão a partir de `unidade_origem` ou `qtde_embalagem_origem`.
