# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar interface real das fórmulas de corte PC3

A migration `engenharia_formulas_corte_v1` foi aplicada em produção com autorização explícita do Francis e pós-check confirmado: tabela criada, 1 seed PC3, 3 variáveis e 11 definições de peças/grupos. O Supabase registrou a aplicação como `20260820160019 / engenharia_formulas_corte_v1`.

A PR #210 já adicionou `lib/formulasCorteEngine.ts`, com parser restrito sem `eval`/`Function()`.

Branch atual `feat/formulas-corte-interface` liga o motor ao banco e adiciona uma tela de validação em `/engenharia/formulas-corte`:
- carrega definições ativas de `engenharia_tipologia_formulas_corte`;
- permite escolher tipologia, largura, altura e variáveis condicionais;
- calcula usando exclusivamente `calcularFormulasCorte` da PR #210;
- mostra resultado por código/eixo em mm;
- não grava plano de corte nem libera produção automaticamente;
- adiciona atalho Master `Fórmulas de Corte` na Sidebar.

### Teste obrigatório após merge/deploy

1. abrir `Engenharia > Fórmulas de Corte`;
2. selecionar `Porta De Correr 03 Folhas (L. Suprema)`;
3. usar 3000 x 2500, `perfil_mao_amigo=comum`, `reforco_mao_amigo=sem`, `contramarco=nao`;
4. confirmar: SU010=2970, SU012=2496, SU008=2483, SU280=2466, SU102(H)=2315 e travessas=938;
5. testar contramarco e confirmar SU010=L-54, SU012=H-16, SU008=H-29, SU280 e montantes=H-46;
6. só depois dessa comparação real decidir integração com plano de corte de produção.

### Pendência de governança de migration

`20260819150000_engenharia_campos_corte_preset_v1.sql` não aparece no histórico remoto do Supabase, mas a coluna `engenharia_variaveis_preset.campos_corte` existe fisicamente no schema. Não corrigir/registrar isso por suposição; tratar em tarefa separada.

## PENDENTE — validar recuperação de senha em produção

A PR #207 já foi mergeada em `main` no commit `045f1fc8f4a75a02a19faa70e51c57d25672798d`, sem migration.

Ainda vale validar em produção:
- envio real do e-mail de recuperação;
- redirect para `/redefinir-senha`;
- login com nova senha;
- troca administrativa por Master sem alterar nome, e-mail, WhatsApp ou role.

### Regras permanentes

- GitHub é a única fonte da verdade;
- nunca commitar direto na `main`;
- branch → PR → Build Validation verde → merge;
- nunca aplicar migration sem autorização explícita e específica do Francis;
- antes de qualquer apply, auditar a fila completa de migrations pendentes;
- nunca interpretar um simples `pode continuar` como autorização de apply quando a autorização específica não tiver sido dada;
- nunca inventar vínculo, tipologia, composição, receita, perfil, acessório ou fórmula por semelhança de nome.
