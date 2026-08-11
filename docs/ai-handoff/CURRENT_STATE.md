# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-11, codigo real da `main` apos PR #61 e branch atual `feat/atlas-professional-producao-v1`.

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
- Medicao Final V2 operacional (PR #54).
- Checklist e fotos V2 (PR #55).
- Link externo seguro da Medicao Final (PR #56).
- Build Validation no GitHub Actions (`npm install` + `npm run build`).

## REDESIGN PROFISSIONAL MERGEADO
- PR #57 — Home executiva, Topbar, workspace e KPIs.
- PR #58 — Sidebar desktop escura em padrao ERP.
- PR #59 — Kanban Comercial profissional.
- PR #60 — Central e Pesquisa de Orcamentos profissionais.
- PR #61 — Medicao Final profissional: painéis V2 agrupados, camada visual dedicada e melhor experiencia desktop/mobile, sem alterar regras V2.

## EM IMPLEMENTACAO NESTE BRANCH
Branch: `feat/atlas-professional-producao-v1`.

Escopo:
- `/producao` recebe escopo `atlas-producao-professional` no AppShell;
- nova folha `app/atlas-producao-professional.css`;
- cabecalho legado ocultado porque AppTopbar ja fornece contexto;
- toolbar, colunas, cards, modais e responsividade refinados em padrao ERP;
- drag-and-drop, CRUD de colunas/cards e persistencia permanecem intactos.

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- Confirmacao de Venda Fase 1: cadastro completo, selecao do orcamento fechado e criacao/reuso de Medicao Final somente ao iniciar processo.
- Importacao de itens via PDF existe, mas PDFs reais W.Vetro ainda nao sao confiaveis em todos os layouts.
- Modulo de IA/agente existe, mas nao foi auditado a fundo.
- CRM existe no codigo; uso real nao confirmado nesta sessao.

## PARCIAL / DIVIDA TECNICA
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
