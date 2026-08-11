# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Branch: `feat/atlas-professional-orcamentos-v1`.

Objetivo: concluir a quarta onda do redesign profissional sem alterar regras de negocio.

Escopo ja implementado no branch:
1. Hub `/orcamento` redesenhado como Central de Orcamentos;
2. atalhos para Novo Orcamento, Orcamento Rapido, Pesquisa e Pipeline Comercial;
3. `/orcamento/pesquisar` integrado visualmente ao Professional Shell;
4. AppShell identifica o escopo de Orcamentos sem afetar `/orcamento/novo` nem o calculo existente;
5. handoff atualizado para refletir PRs #55 a #59 e link externo ja mergeado.

### Proxima acao obrigatoria
1. abrir PR deste branch;
2. aguardar Build Validation do GitHub Actions;
3. se houver erro de codigo, corrigir no mesmo branch;
4. se passar, revisar diff e mergear na `main`;
5. depois iniciar branch separada para a proxima tela do Design System.

## REDESIGN PROFISSIONAL JA NA MAIN
- PR #57: Home executiva + Topbar + KPIs/workspace;
- PR #58: Sidebar desktop escura em padrao ERP;
- PR #59: Kanban Comercial profissional.

A regra continua sendo preservar logica existente e modernizar por camada visual sempre que possivel.

## MEDICAO FINAL V2 JA NA MAIN
- V20 aplicada e validada no Supabase;
- responsavel/status/liberar/iniciar/concluir/aprovar;
- pendencias e bloqueios;
- checklist normalizado por peca/tipologia/secao;
- fotos categorizadas;
- compatibilidade com checklist legado;
- link externo seguro com token-hash, expiracao/revogacao, medidas, checklist, fotos e conclusao para revisao interna.

## PROXIMOS BLOCOS RECOMENDADOS
Depois do redesign de Orcamentos:
1. refinar visual da Medicao Final preservando a logica V2;
2. padronizar Producao;
3. padronizar Engenharia;
4. validar funcionalmente Confirmacao de Venda Fase 1;
5. definir motor simples de regras condicionais e `exigir_foto_quando`;
6. criar liberacao persistente para Engenharia apos aprovacao;
7. Fase 2 PDF W.Vetro -> Orcamento Atlas estruturado e conferivel.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`.
- Branch -> PR -> build valido -> merge.
- A Vercel esta com cota diaria de builds; o workflow `Build Validation` do GitHub Actions valida `npm run build`, mas o deploy de producao continua dependendo da Vercel.
- Nao reinterpretar automaticamente medicoes ja concluidas.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
- Nao alterar formulas de Orcamento durante tarefas puramente visuais.
