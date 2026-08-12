# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-11, `main` apos PR #76 e migration `20260812000000_engenharia_receitas_tipologia_v1.sql` aplicada e validada.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- CI Supabase via Session Pooler IPv4 com audit/dry-run em PR.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).
- Medicao Final V2 operacional (PRs #54, #55 e #56), incluindo checklist/fotos e link externo seguro.
- PR #64: Medicao Final aprovada entra de forma atomica/idempotente na Engenharia.
- PR #66: modulo proprio de Engenharia em `/engenharia`.
- PR #69: conferencia tecnica persistente por peca e bloqueio de liberacao incompleta.
- PR #73: liberacao real Engenharia -> Producao, com registro de quem liberou/quando e criacao/atualizacao idempotente do card em `producao_itens`.
- PR #76: base de receitas tecnicas por tipologia em `/engenharia/receitas`, com componentes tecnicos e vinculo opcional ao cadastro `produtos`.
- Migration `20260812000000_engenharia_receitas_tipologia_v1.sql` aplicada e validada no Supabase.

## REDESIGN PROFISSIONAL MERGEADO
- PR #57 — Home executiva, Topbar, workspace e KPIs.
- PR #58 — Sidebar desktop escura em padrao ERP.
- PR #59 — Kanban Comercial profissional.
- PR #60 — Central e Pesquisa de Orcamentos profissionais.
- PR #61 — Medicao Final profissional.
- PR #62 — Kanban de Producao profissional.
- PR #63 — base profissional dos setores genericos.
- PR #66 — Engenharia com rota propria e linguagem visual do Atlas.

## ENGENHARIA — ESTADO REAL
- Fase 1 concluida: Medicao Final aprovada entra automaticamente na Engenharia.
- Fase 2 concluida: rota `/engenharia`, fluxo Recebidas -> Conferencia tecnica -> Em desenvolvimento -> Liberado para producao.
- Fase 3 concluida: conferencia tecnica persistente por peca, responsavel/observacao/status e bloqueio de liberacao incompleta.
- Fase 4 concluida: liberacao transacional para Producao, com registro de quem/quando e card idempotente em `producao_itens`.
- Fase 5 concluida: receitas tecnicas persistentes ligadas a `tipologias`, com versao, receita ativa e componentes classificados como perfil, acessorio, vidro, reforco ou outro.
- Componentes podem apontar para `produtos` quando houver cadastro tecnico; componentes manuais continuam permitidos.
- Campos `formula_quantidade` e `formula_corte` existem, mas ainda nao sao executados automaticamente.
- Ainda nao existe MEE automatico, lista de materiais calculada, lista de corte ou otimizacao de barras.

## PROXIMA FASE RECOMENDADA
Engenharia Fase 6 — motor de calculo/MEE v1 em modo de simulacao:
- definir sintaxe segura para formulas de quantidade e corte;
- usar largura/altura/quantidade da Medicao Final como variaveis;
- calcular uma peca por vez sem gravar automaticamente em Producao/Estoque;
- mostrar preview da lista de materiais e cortes;
- registrar erros de formula de forma legivel;
- preservar a versao da receita usada no calculo;
- somente depois liberar geracao persistente de materiais/cortes.

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- Confirmacao de Venda Fase 1.
- Importacao de itens via PDF; PDFs W.Vetro ainda nao sao confiaveis em todos os layouts.
- Modulo de IA/agente existe, mas nao foi auditado a fundo.
- CRM existe no codigo; uso real nao confirmado nesta sessao.

## PARCIAL / DIVIDA TECNICA
- Entidade persistente `vendas`/`obras` ainda nao existe.
- Regras condicionais completas do checklist V2 e `exigir_foto_quando` ainda pendentes.
- Conversao PDF W.Vetro -> Orcamento Atlas estruturado e conferivel ainda precisa de tela de revisao.
- Design System ainda nao foi aplicado em todas as telas antigas.
- `lib/calculos.ts` ainda nao usa categoria dinamica de tipologia em todas as formulas.
- Testes automatizados de regra de negocio ainda nao existem.

## SEGURANCA / MIGRATIONS
- Acesso externo da Medicao Final e server-side, com token-hash, validade e revogacao.
- Geracao/revogacao respeita permissoes do Atlas; Master tem edicao total.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
