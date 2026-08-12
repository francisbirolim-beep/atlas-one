# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
A Engenharia Fase 5 foi concluida no PR #76 e a migration `20260812000000_engenharia_receitas_tipologia_v1.sql` foi aplicada e validada no Supabase.

## PROXIMA TAREFA — ENGENHARIA FASE 6
Criar o motor de calculo/MEE v1 em modo de simulacao, usando as receitas tecnicas sem ainda gravar automaticamente materiais ou cortes em Producao/Estoque.

Escopo recomendado:
1. definir sintaxe segura para `formula_quantidade` e `formula_corte`;
2. expor variaveis controladas: largura, altura, quantidade e medidas finais relevantes;
3. avaliar a receita de uma peca usando a versao ativa da tipologia;
4. gerar preview de componentes, quantidades e cortes;
5. mostrar erros de formula de forma legivel, sem executar codigo arbitrario;
6. registrar no resultado qual receita/versao foi usada;
7. permitir revisao tecnica antes de persistir qualquer lista de materiais.

## DEPOIS DA FASE 6
- persistir lista de materiais calculada por obra;
- gerar lista de corte;
- otimizar barras;
- integrar materiais com Estoque e liberacao tecnica com Producao.

## JA NA MAIN
- Medicao Final V2 PRs #54 a #56.
- Redesign profissional PRs #57 a #63.
- Engenharia Fase 1 PR #64: entrada automatica apos aprovacao da Medicao Final.
- Engenharia Fase 2 PR #66: rota `/engenharia`, KPIs, quatro etapas e detalhe das pecas.
- Engenharia Fase 3 PR #69: conferencia tecnica persistente e bloqueio de liberacao incompleta.
- Engenharia Fase 4 PR #73: liberacao transacional para Producao e card idempotente.
- Engenharia Fase 5 PR #76: receitas tecnicas por tipologia, componentes e campos de formulas; migration aplicada.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`.
- Branch -> PR -> build valido -> merge.
- Migration: dry-run em PR antes de apply controlado.
- O motor de formulas nao pode usar `eval`, `Function` ou executar JavaScript arbitrario.
- Nao persistir materiais/cortes automaticamente antes de existir tela de revisao do preview.
- Vercel pode continuar sujeita a cota diaria; Build Validation confirma o codigo, mas producao depende do deploy.
