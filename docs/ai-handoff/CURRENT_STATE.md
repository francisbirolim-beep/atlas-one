# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-13, `main` apos PR #107; branch atual corrige a inversao Baixo/Cima observada na leitura de LARGURA.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- No primeiro estagio do Kanban, qualquer pedido exige `Iniciar orçamento`; pedidos ja iniciados mostram `Retornar orçamento`.
- Fotos do pedido sao preservadas ao abrir o Kanban.
- PR #105: cada esquadria exibe `Fotos coletadas em campo` antes das medidas, com multiplas fotos e `Adicionar fotos` sem apagar as anteriores.
- PR #106: `foto_larguras_url` aparece como `LARGURA`, `foto_alturas_url` como `ALTURA` e fotos gerais ficam em `Outras fotos` sem duplicacao.
- PR #107: leitura por IA das fotos de LARGURA/ALTURA no Kanban, conversao para mm, preenchimento das seis medidas somente quando as tres leituras do eixo forem reconhecidas e preservacao do preenchimento manual.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- CI Supabase via Session Pooler IPv4 com audit/dry-run em PR.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).
- Medicao Final V2 operacional (PRs #54, #55 e #56), incluindo checklist/fotos e link externo seguro.
- A rota autenticada `/api/medicao-final/ler-trena` usa visao por IA para interpretar fotos do visor da trena/medidor laser.
- PR #64: Medicao Final aprovada entra de forma atomica/idempotente na Engenharia.
- PR #66: modulo proprio de Engenharia em `/engenharia`.
- PR #69: conferencia tecnica persistente por peca e bloqueio de liberacao incompleta.
- PR #73: liberacao real Engenharia -> Producao, com registro de quem liberou/quando e criacao/atualizacao idempotente do card em `producao_itens`.
- Migration `20260811200000_engenharia_liberacao_producao_v1.sql` aplicada e validada no Supabase.

## AJUSTE EM VALIDACAO NESTA BRANCH
- Teste real do PR #107 mostrou que, na LARGURA, o valor pertencente a `Baixo` foi colocado em `Cima` e vice-versa.
- Correcao desta branch: inverter somente o primeiro e o terceiro valor da LARGURA antes de preencher os campos; `Meio` permanece inalterado.
- Exemplo validado no teste: resultado anterior `1789 / 1791 / 1790` deve virar `Baixo 1790 / Meio 1791 / Cima 1789`.
- ALTURA nao e alterada nesta correcao; permanece `Direita -> Meio -> Esquerda` conforme o comportamento atual validado pelo usuario.
- A foto permanece salva mesmo se a IA falhar ou estiver indisponivel.
- O usuario recebe status/confianca da leitura e deve conferir os valores antes de salvar o orcamento.

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
- Fase 4 concluida: ao liberar, o Atlas registra quem/quando e cria ou atualiza de forma idempotente a entrada correspondente na Producao usando `orcamento_id`.
- A liberacao e transacional e revalida a conferencia tecnica antes de enviar para Producao.
- Fonte unica dos cards da Engenharia continua sendo `setor_kanban_itens`.
- Ainda nao existe MEE/calculo tecnico automatico, receitas de tipologias, lista de corte ou otimizacao.

## PROXIMA FASE RECOMENDADA
Engenharia Fase 5 — base de receitas tecnicas por tipologia:
- cadastrar receita tecnica por tipologia;
- vincular perfis, acessorios, vidros, reforcos e regras de quantidade;
- permitir revisao/versao da receita;
- preparar formulas sem ainda automatizar todo o MEE;
- manter rastreabilidade entre tipologia, receita e obra.

Depois disso: calculos/MEE, lista de materiais, lista de corte e otimizacao de barras.

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
