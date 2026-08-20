# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar motor declarativo de fórmulas de corte PC3

Continuidade do trabalho iniciado pelo Claude após a PR #209.

Estado atual:
- migration `20260820000000_engenharia_formulas_corte_v1.sql` já está na `main`;
- ela cria `engenharia_tipologia_formulas_corte` e contém o seed da tipologia `Porta De Correr 03 Folhas (L. Suprema)` com fórmulas derivadas de amostras reais do W.Vetro #994;
- a migration **não deve ser considerada aplicada** enquanto não houver apply remoto confirmado;
- branch `feat/formulas-corte-engine-pc3` adiciona `lib/formulasCorteEngine.ts` com parser aritmético restrito e resolução declarativa;
- nenhuma tela visual para cadastrar fórmulas foi criada nesta etapa;
- nenhum plano de corte de produção é gerado automaticamente nesta etapa.

### Critério de validação do motor

Usar o caso real já registrado do W.Vetro #994, 3000 x 2500, sem contramarco e mão-de-amigo comum:
- SU010 = 2970;
- SU012 = 2496;
- SU008 = 2483;
- SU280 = 2466;
- SU102(H) = 2315;
- travessas = 938 (`ROUND(SU010 / 3) - 52`).

Também validar o comportamento com contramarco, onde as amostras registradas indicam:
- SU010: `Largura - 54`;
- SU012: `Altura - 16`;
- SU008: `Altura - 29`;
- SU280 e montantes de mão-de-amigo: `Altura - 46`.

### Próximos passos

1. abrir PR da branch e aguardar Build Validation + Vercel Preview;
2. revisar o diff para garantir que o motor não usa `eval`/`Function()` e rejeita tokens inválidos;
3. só depois do merge decidir se a migration `20260820000000_engenharia_formulas_corte_v1.sql` deve ser aplicada;
4. **não aplicar essa migration sem autorização explícita e específica do Francis**;
5. antes de qualquer apply, auditar a fila completa de migrations pendentes;
6. após eventual apply, criar uma tela de teste/validação das fórmulas antes de conectar o motor ao plano de corte real;
7. não gerar fórmulas para outras tipologias por semelhança de nome ou formato.

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
