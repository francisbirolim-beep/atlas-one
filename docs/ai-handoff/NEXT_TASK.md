# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar os quatro desenhos PC3 no orçamento

A branch `feat/pc3-imagens-grid-4` adicionou os quatro desenhos confirmados do print W.Vetro ao repositório e alterou o seletor para exibi-los somente nos quatro presets exatos de `SUPREMA → PORTA DE CORRER 03 FOLHAS`.

Estado desta etapa:
- `*SUCB-PC3-01EF` → desenho estático validado;
- `*SUCB-PC3-02-EF` → desenho estático validado;
- `*SUCB-PC3-03-EF` → desenho estático validado;
- `*SUCB-PC3-04-EF` → desenho estático validado;
- `imagem_url` manual continua tendo prioridade;
- nenhum outro preset recebe imagem por semelhança;
- desktop passa a mostrar até 4 cards na mesma linha;
- nenhuma migration e nenhum write de banco nesta etapa.

### Próximos passos diretos

1. concluir PR com Build Validation e Vercel Preview verdes;
2. abrir o preview e validar `SUPREMA → PORTA DE CORRER 03 FOLHAS`;
3. confirmar que os quatro cards mostram, respectivamente, os desenhos 01EF, 02-EF, 03-EF e 04-EF;
4. conferir que o layout desktop mantém os quatro cards na mesma linha quando houver largura suficiente;
5. depois da validação visual, decidir se vale persistir as mesmas imagens em `imagem_url` via edição Master, mantendo o ativo estático apenas como fallback histórico;
6. não preencher `composicao_folha_N` com base apenas nos desenhos.

### Estado técnico já consolidado

A migration `20260819062000_corrigir_pc3_suprema_cadastro_v1.sql` já foi aplicada em produção com autorização explícita do Francis. Os quatro presets estão em `l_suprema_porta_de_correr_03_folhas`, com `valores = {}`, e não permanecem na tipologia Janela de Correr 03 Folhas.

### Regras permanentes

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- branch → PR → Build Validation verde → merge;
- nunca aplicar migration sem autorização explícita e específica do Francis;
- antes de qualquer apply, auditar a fila completa de migrations pendentes;
- nunca interpretar um simples `pode continuar` como autorização de apply quando a autorização específica não tiver sido dada;
- nunca inventar vínculo, tipologia, composição, receita, perfil, acessório ou fórmula por semelhança de nome;
- desenho técnico é evidência visual; não convertê-lo automaticamente em receita ou composição estruturada sem regra validada.
