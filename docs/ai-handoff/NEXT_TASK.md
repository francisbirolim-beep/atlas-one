# NEXT_TASK.md — Atlas One

## GATE ATUAL — aplicar correção PC3 Suprema / JC3 incorreto

Migration pendente já mergeada em `main`:

`supabase/migrations/20260819062000_corrigir_pc3_suprema_cadastro_v1.sql`

PR de origem: #197. Merge: `46a22f4527b60f2bd6da90089f6bb4f018bfa3f5`.

Build Validation, Vercel e Supabase Database Control dry-run passaram. **Nenhum apply foi executado.**

### Próximo passo obrigatório

1. obter autorização explícita e específica do Francis para aplicar a correção em produção;
2. antes do apply, auditar novamente a fila completa de migrations pendentes — o workflow não é seletivo por arquivo;
3. somente se a fila estiver compatível com a autorização, executar `Supabase Database Control` em `main`, `mode=apply`, `confirmation=APPLY_PRODUCTION`;
4. acompanhar o job até conclusão;
5. confirmar pós-estado:
   - exatamente 4 presets PC3 sob `l_suprema_porta_de_correr_03_folhas`;
   - nomes: `*SUCB-PC3-01EF`, `*SUCB-PC3-02-EF`, `*SUCB-PC3-03-EF`, `*SUCB-PC3-04-EF`;
   - zero desses alvos em `l_suprema_janela_de_correr_03_folhas`;
   - `valores = {}` nos 4 presets;
   - zero vínculos `composicao_folha_1..6` nas tipologias L. Suprema > Janela de Correr 02/03/04/06 folhas.

### Depois do apply confirmado

1. usar a edição implementada na PR #196 para anexar os desenhos aos quatro presets existentes sem duplicá-los;
2. validar no orçamento `SUPREMA → PORTA DE CORRER 03 FOLHAS` e conferir os 4 cards PC3;
3. revisar a arquitetura de composição antes de cadastrar novos valores estruturados: o projeto 02EF demonstra que uma folha/painel pode ter mais de um material/componente visual na vertical;
4. não replicar 02/04/06 folhas ou outras linhas até existir evidência real e uma modelagem capaz de representar o desenho sem inferência.

### Regras permanentes

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- branch → PR → Build Validation verde → merge;
- nunca aplicar migration sem autorização explícita e específica do Francis;
- nunca interpretar `pode continuar` como autorização de apply;
- nunca inventar vínculo/tipologia/composição por semelhança de nome;
- desenho técnico é evidência visual; não convertê-lo automaticamente em receita ou composição estruturada sem regra validada.
