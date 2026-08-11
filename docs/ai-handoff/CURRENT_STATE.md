# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-11, `main` apos PR #64 e branch atual `feat/engenharia-modulo-v1`.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- CI Supabase via Session Pooler IPv4 com audit/dry-run em PR.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).
- Medicao Final V2 operacional (PRs #54, #55 e #56), incluindo checklist/fotos e link externo seguro.
- PR #63: base profissional para setores genericos.
- PR #64: Medicao Final aprovada cria/atualiza de forma atomica e idempotente a entrada correspondente na Engenharia; migration `20260811181300_engenharia_entrada_automatica.sql` aplicada e validada.

## REDESIGN PROFISSIONAL MERGEADO
- PR #57 — Home executiva, Topbar, workspace e KPIs.
- PR #58 — Sidebar desktop escura em padrao ERP.
- PR #59 — Kanban Comercial profissional.
- PR #60 — Central e Pesquisa de Orcamentos profissionais.
- PR #61 — Medicao Final profissional.
- PR #62 — Kanban de Producao profissional.
- PR #63 — base profissional dos setores genericos.

## ENGENHARIA — EM IMPLEMENTACAO NESTE BRANCH
Branch: `feat/engenharia-modulo-v1`.

Escopo implementado:
- rota dedicada `/engenharia`;
- reutiliza `setor_kanban_itens` como fonte unica de cards, sem duplicar dados;
- KPIs operacionais;
- quatro etapas tecnicas: Recebidas, Conferencia tecnica, Em desenvolvimento e Liberado para producao;
- drag-and-drop respeitando permissoes `oculto/consulta/edicao`;
- detalhe de cada obra com cliente, local, Medicao Final aprovada e pecas com as 6 medidas finais;
- acesso de retorno para a Medicao Final original;
- migration ativa a rota `/engenharia` no cadastro do setor e padroniza as quatro etapas.

## FORA DO ESCOPO DESTA FASE
- MEE/calculo tecnico automatico.
- Receitas de tipologias, perfis, acessorios e reforcos.
- Lista de corte e otimizacao de barras.
- Geracao automatica de materiais.
- Entidade persistente `vendas`/`obras` ainda nao existe.

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- Confirmacao de Venda Fase 1.
- Importacao de itens via PDF; PDFs W.Vetro ainda nao sao confiaveis em todos os layouts.
- Modulo de IA/agente existe, mas nao foi auditado a fundo.
- CRM existe no codigo; uso real nao confirmado nesta sessao.

## PARCIAL / DIVIDA TECNICA
- Regras condicionais completas do checklist V2 e `exigir_foto_quando` ainda pendentes.
- Conversao PDF W.Vetro -> Orcamento Atlas estruturado e conferivel ainda precisa de tela de revisao.
- Design System ainda nao foi aplicado em todas as telas antigas.
- `lib/calculos.ts` ainda nao usa categoria dinamica de tipologia em todas as formulas.
- Testes automatizados de regra de negocio ainda nao existem.

## SEGURANCA / MIGRATIONS
- Acesso externo da Medicao Final e server-side, com token-hash, validade e revogacao.
- Geracao/revogacao respeita permissoes do Atlas; Master tem edicao total.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
