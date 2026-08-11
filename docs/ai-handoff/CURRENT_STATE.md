# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-11, `main` apos PR #66 e branch atual `feat/engenharia-conferencia-tecnica-v1`.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- CI Supabase via Session Pooler IPv4 com audit/dry-run em PR.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).
- Medicao Final V2 operacional (PRs #54, #55 e #56), incluindo checklist/fotos e link externo seguro.
- Redesign profissional PRs #57 a #63.
- Engenharia Fase 1 PR #64: Medicao Final aprovada cria/atualiza entrada automatica e idempotente na Engenharia.
- Engenharia Fase 2 PR #66: rota `/engenharia`, KPIs, etapas Recebidas, Conferencia tecnica, Em desenvolvimento e Liberado para producao; migration `20260811183500_engenharia_modulo_v1.sql` aplicada e validada.

## ENGENHARIA FASE 3 — EM IMPLEMENTACAO NO PR #69
Branch: `feat/engenharia-conferencia-tecnica-v1`.

Escopo implementado:
- tabela `engenharia_conferencias`, uma linha por `medicao_item_id`;
- status por peca: `pendente`, `conferida` ou `pendencia`;
- observacao tecnica por peca;
- responsavel e data da conferencia por peca;
- tela de Engenharia mostra e edita a conferencia no detalhe da obra;
- progresso tecnico por obra;
- bloqueio visual da liberacao quando a conferencia nao esta completa;
- trigger no banco bloqueia movimentacao para `Liberado para producao` se qualquer peca nao estiver `conferida`.

Migration desta fase: `20260811192000_engenharia_conferencia_tecnica_v1.sql`.
Status: Build Validation e dry-run Supabase passaram no primeiro head do PR; handoff atualizado antes do merge final. Migration ainda nao aplicada em producao enquanto o PR #69 nao for integrado.

## FORA DO ESCOPO / PROXIMAS CAMADAS
- responsavel tecnico no nivel da obra ainda nao existe como entidade propria;
- auditoria explicita de quem liberou a obra para Producao e quando ainda nao existe;
- MEE/calculo tecnico automatico ainda nao existe;
- receitas de tipologias, perfis, acessorios, reforcos, vidros, lista de materiais, lista de corte e otimizacao ainda nao existem;
- entidade persistente `vendas`/`obras` ainda nao existe.

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
