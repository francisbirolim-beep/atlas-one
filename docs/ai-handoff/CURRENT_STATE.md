# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-11, codigo real da `main` apos PRs #54 a #59 e branch atual de redesign de Orcamentos.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos com colunas dinamicas, drag-and-drop, historico e automacoes existentes.
- Cadastro de clientes, fornecedores e produtos.
- Orcamento rapido e orcamento balcao.
- Tipologias dinamicas.
- Automacoes de setor e tarefas.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- Conexao de CI com Supabase via Session Pooler IPv4; audit/dry-run de migrations em PR.
- Historico local de migrations reconciliado com o historico remoto.
- Migration V20 `20260811110000_medicao_final_v2.sql` aplicada e validada no Supabase.
- Medicao Final V2 operacional (PR #54): responsavel, status operacional, liberar, iniciar, concluir, aprovar, pendencias e bloqueios.
- Checklist e fotos V2 (PR #55): respostas normalizadas em `medicao_respostas`, compatibilidade com `campos_extras`, checklist por peca/tipologia/secao e fotos categorizadas.
- Link externo seguro da Medicao Final (PR #56): token aleatorio armazenado somente como hash, expiracao/revogacao, pagina publica restrita, medidas, checklist, fotos e conclusao para revisao interna; aprovacao permanece interna.
- Build Validation no GitHub Actions (`npm install` + `npm run build`) funcionando e usado para validar PRs quando a Vercel bloqueia builds por cota.

## REDESIGN PROFISSIONAL MERGEADO
- PR #57 — Professional Shell V1: Home executiva, Topbar corporativa, workspace e KPIs refinados.
- PR #58 — Sidebar profissional: navegacao desktop escura em padrao ERP sem reescrever favoritos, categorias, setores e permissoes.
- PR #59 — Kanban Comercial profissional: nova camada visual, filtros e cards refinados, preservando drag-and-drop e regras.

## EM IMPLEMENTACAO NESTE BRANCH
Branch: `feat/atlas-professional-orcamentos-v1`.

Escopo:
- Hub `/orcamento` redesenhado como Central de Orcamentos;
- acesso destacado para Novo Orcamento, Orcamento Rapido, Pesquisa e Pipeline Comercial;
- `/orcamento/pesquisar` recebe a camada visual profissional do AppShell;
- nenhuma formula, regra de preco ou persistencia de orcamento e alterada.

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- Confirmacao de Venda Fase 1:
  - mover para coluna `gera_medicao_final=true` abre `/vendas/confirmar` e nao cria processos operacionais sozinho;
  - exige cadastro completo do cliente;
  - permite selecionar qual orcamento foi fechado;
  - bloqueia inicio sem itens estruturados;
  - cria/reutiliza Medicao Final e dispara automacoes somente em `Iniciar processo da venda`.
- Importacao de itens via PDF existe, mas PDFs reais W.Vetro ainda nao sao confiaveis em todos os layouts.
- Modulo de IA/agente existe, mas nao foi auditado a fundo.
- CRM existe no codigo; uso real nao confirmado nesta sessao.

## PARCIAL / DIVIDA TECNICA
- Regras condicionais completas do checklist V2 ainda nao possuem motor de avaliacao final definido/validado.
- `exigir_foto_quando` ainda precisa de validacao operacional antes de concluir/aprovar.
- Conversao PDF W.Vetro -> Orcamento Atlas estruturado e conferivel ainda precisa de tela de revisao.
- Entidade persistente `vendas`/`obras` ainda nao existe.
- Design System ainda nao foi aplicado em todas as telas antigas.
- `lib/calculos.ts` ainda nao usa categoria dinamica de tipologia para formulas porta/janela.
- Parser de PDF e heuristico e nao deve liberar operacao sem conferencia.
- Liberacao automatica para Engenharia como etapa persistente independente apos aprovacao ainda nao existe.
- Testes automatizados de regra de negocio ainda nao existem.

## SEGURANCA / MIGRATIONS
- `medicao_acessos_externos` tem RLS habilitado e sem policy permissiva de client; acesso externo e feito por Route Handlers server-side/service role.
- Links externos respeitam validade/revogacao e deixam de aceitar escrita depois da conclusao da medicao.
- Geracao/revogacao interna respeita permissoes do Atlas; Master tem edicao total.
- Migrations antigas que existiam apenas remotamente foram recuperadas e versionadas em `supabase/migrations/`; nao usar `migration repair --reverted` no banco atual sem motivo explicito.
