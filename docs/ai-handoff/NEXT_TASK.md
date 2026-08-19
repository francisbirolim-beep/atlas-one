# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — anexar desenhos PC3 e validar o fluxo no orçamento

A correção `20260819062000_corrigir_pc3_suprema_cadastro_v1.sql` já foi aplicada em produção com autorização explícita do Francis e confirmação no histórico remoto.

Estado atual:
- `SUPREMA → PORTA DE CORRER 03 FOLHAS` possui exatamente 4 presets:
  - `*SUCB-PC3-01EF`;
  - `*SUCB-PC3-02-EF`;
  - `*SUCB-PC3-03-EF`;
  - `*SUCB-PC3-04-EF`;
- os 4 presets estão com `valores = {}` porque a composição anterior foi inferida incorretamente;
- nenhum desses alvos permanece em `SUPREMA → JANELA DE CORRER 03 FOLHAS`;
- os vínculos `composicao_folha_N` foram removidos das janelas Suprema 02/03/04/06;
- variáveis/opções globais continuam disponíveis para uma futura modelagem correta.

### Próximos passos diretos

1. usar a edição implementada na PR #196 para anexar a imagem correta a cada um dos quatro presets existentes, sem duplicá-los;
2. validar no orçamento o fluxo `SUPREMA → PORTA DE CORRER 03 FOLHAS` e confirmar que aparecem os 4 cards PC3;
3. conferir visualmente código, nome e desenho de cada card contra o print W.Vetro;
4. não preencher novamente `composicao_folha_N` nesses projetos até existir uma modelagem capaz de representar subdivisões verticais/mistas dentro de um painel;
5. somente depois dessa validação decidir a expansão para outras tipologias/linhas com evidência real.

### Desenhos já preparados

Foram recortados novamente do print original W.Vetro os desenhos correspondentes a:
- `SUCB-PC3-01EF`;
- `SUCB-PC3-02-EF`;
- `SUCB-PC3-03-EF`;
- `SUCB-PC3-04-EF`.

Eles devem ser enviados pelo campo de imagem da edição da configuração validada. O desenho é evidência visual; não converter automaticamente seus elementos em receita técnica ou variáveis sem regra validada.

### Regras permanentes

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- branch → PR → Build Validation verde → merge;
- nunca aplicar migration sem autorização explícita e específica do Francis;
- antes de qualquer apply, auditar a fila completa de migrations pendentes;
- nunca interpretar um simples `pode continuar` como autorização de apply quando a autorização específica não tiver sido dada;
- nunca inventar vínculo, tipologia, composição, receita, perfil, acessório ou fórmula por semelhança de nome;
- desenho técnico é evidência visual; não convertê-lo automaticamente em receita ou composição estruturada sem regra validada.
