# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-11, codigo real da `main` apos PR #62 e branch atual `feat/atlas-professional-setores-base-v1`.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos com colunas dinamicas, drag-and-drop, historico e automacoes.
- Cadastro de clientes, fornecedores e produtos.
- Orcamento rapido e orcamento balcao.
- Tipologias dinamicas.
- Automacoes de setor e tarefas.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- CI com Supabase via Session Pooler IPv4; audit/dry-run de migrations em PR.
- Migration V20 da Medicao Final V2 aplicada e validada.
- Medicao Final V2 operacional (PR #54), checklist/fotos V2 (PR #55) e link externo seguro (PR #56).
- Build Validation no GitHub Actions (`npm install` + `npm run build`).

## REDESIGN PROFISSIONAL MERGEADO
- PR #57 — Home executiva, Topbar, workspace e KPIs.
- PR #58 — Sidebar desktop escura em padrao ERP.
- PR #59 — Kanban Comercial profissional.
- PR #60 — Central e Pesquisa de Orcamentos profissionais.
- PR #61 — Medicao Final profissional.
- PR #62 — Kanban de Producao profissional, preservando drag-and-drop e CRUD.

## ENGENHARIA / MEE — ESTADO REAL
- Nao existe hoje uma rota funcional especifica de Engenharia/MEE no repositorio.
- Setores sem rota propria usam `app/setor/[slug]/page.tsx`, um Kanban generico com permissoes `oculto/consulta/edicao`.
- Portanto, Engenharia hoje usa essa base generica quando cadastrada sem rota ativa. Nao considerar o MEE especializado implementado apenas porque aparece em documentacao/IA.

## EM IMPLEMENTACAO NESTE BRANCH
Branch: `feat/atlas-professional-setores-base-v1`.

Escopo:
- `/setor/[slug]` recebe escopo visual `atlas-setor-professional` no AppShell;
- nova folha `app/atlas-setor-professional.css`;
- Kanban generico refinado para servir como base profissional de Engenharia e demais setores ainda sem modulo proprio;
- permissoes, drag-and-drop, CRUD e redirecionamento para setores com rota ativa permanecem intactos.

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- Confirmacao de Venda Fase 1.
- Importacao de itens via PDF; PDFs W.Vetro ainda nao sao confiaveis em todos os layouts.
- Modulo de IA/agente existe, mas nao foi auditado a fundo.
- CRM existe no codigo; uso real nao confirmado nesta sessao.

## PARCIAL / DIVIDA TECNICA
- MEE/Engenharia especializado ainda precisa ser implementado como modulo/rota propria.
- Regras condicionais completas do checklist V2 e `exigir_foto_quando` ainda pendentes.
- Conversao PDF W.Vetro -> Orcamento Atlas estruturado e conferivel ainda precisa de tela de revisao.
- Entidade persistente `vendas`/`obras` ainda nao existe.
- Design System ainda nao foi aplicado em todas as telas antigas.
- `lib/calculos.ts` ainda nao usa categoria dinamica de tipologia em todas as formulas.
- Liberacao persistente para Engenharia apos aprovacao ainda nao existe.
- Testes automatizados de regra de negocio ainda nao existem.

## SEGURANCA / MIGRATIONS
- Acesso externo da Medicao Final e server-side, com token-hash, validade e revogacao.
- Geracao/revogacao respeita permissoes do Atlas; Master tem edicao total.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
