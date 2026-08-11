# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-11, codigo real da `main` e branch `feat/medicao-final-v2-checklist`.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos com colunas dinamicas, drag-and-drop e historico.
- Cadastro de clientes, fornecedores e produtos.
- Orcamento rapido e orcamento balcao.
- Checklist legado de Medicao Final por tipologia (numero/texto/foto, obrigatorio).
- Medicao Final: medir/reabrir item.
- Tipologias dinamicas.
- Automacoes de setor e tarefas.
- Exclusao de Medicao Final pelo Master e limpeza de cards derivados por orcamento.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Home/Painel de Gestao com indicadores, alertas operacionais, acoes rapidas, agenda e produtividade.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- Conexao de CI com Supabase via Session Pooler IPv4; audit/dry-run de migrations em PR.
- Historico local de migrations reconciliado com o historico remoto.
- Migration V20 `20260811110000_medicao_final_v2.sql` APLICADA e validada no Supabase; dry-run posterior confirmou banco sem migrations pendentes.
- Medicao Final V2 operacional (PR #54): responsavel, status operacional, liberar, iniciar, concluir, aprovar, pendencias abertas/resolvidas e bloqueios de conclusao por pecas nao medidas/unidades agrupadas/pendencias.

## IMPLEMENTADO MAS AINDA NAO MERGEADO
### PR #55 — Checklist e fotos V2 da Medicao Final
Branch: `feat/medicao-final-v2-checklist`.

Codigo implementado:
- `lib/medicaoChecklistV2.ts`:
  - leitura de itens, campos dinamicos, respostas estruturadas e fotos;
  - respostas persistidas em `medicao_respostas`;
  - espelho em `medicao_itens.campos_extras` para compatibilidade com a tela legada;
  - fotos categorizadas em `medicao_fotos`;
  - validacao de campos obrigatorios.
- `components/system/MedicaoChecklistV2Panel.tsx`:
  - checklist por peca;
  - separacao por secoes;
  - suporte a numero, texto, foto e opcoes configuradas;
  - progresso de obrigatorios por peca;
  - galeria de fotos categorizadas por peca;
  - upload/remocao de fotos.
- `components/system/AppShell.tsx` injeta o painel V2 no detalhe da Medicao Final sem reescrever o formulario legado.

Validacao: PR #55 aberto. A Vercel NAO compilou o codigo porque a conta atingiu `build-rate-limit`; o status failure atual nao representa erro de TypeScript. O ambiente local do agente tambem nao possui acesso de rede ao GitHub/NPM, portanto o PR NAO deve ser mergeado ate existir build Vercel valido.

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- Nova Confirmacao de Venda:
  - mover para coluna `gera_medicao_final=true` abre `/vendas/confirmar` e nao cria processos operacionais sozinho;
  - exige cadastro completo do cliente;
  - permite selecionar qual orcamento foi fechado;
  - bloqueia inicio sem itens estruturados;
  - cria/reutiliza Medicao Final e dispara automacoes somente em `Iniciar processo da venda`.
- Importacao de itens via PDF existe, mas PDFs reais W.Vetro ainda nao sao confiaveis em todos os layouts.
- Modulo de IA/agente existe, mas nao foi auditado a fundo.
- CRM existe no codigo; uso real nao confirmado nesta sessao.

## PARCIAL / DIVIDA TECNICA
- Conversao PDF W.Vetro -> Orçamento Atlas estruturado e conferivel ainda precisa de uma tela de revisao.
- Entidade persistente `vendas`/`obras` ainda nao existe.
- Design System ainda nao foi aplicado em todas as telas antigas.
- `lib/calculos.ts` ainda nao usa categoria dinamica de tipologia para formulas porta/janela.
- Parser de PDF e heuristico e nao deve liberar operacao sem conferencia.

## NAO IMPLEMENTADO
- Link externo funcional e seguro da Medicao Final. O schema existe (`medicao_acessos_externos`), mas Route Handler/token ainda nao foram implementados.
- Regras condicionais completas do checklist V2 ainda nao possuem motor de avaliacao definido/validado na interface.
- Liberacao automatica para Engenharia como etapa persistente independente apos aprovacao.
- Entidade `vendas` ou `obras`.
- Testes automatizados.
- Design System ponta a ponta.

## SEGURANCA / MIGRATIONS
- `medicao_acessos_externos` tem RLS habilitado e SEM policy permissiva de client; qualquer link externo deve usar Route Handler server-side/service role.
- Migrations antigas que existiam apenas remotamente foram recuperadas e versionadas em `supabase/migrations/`; nao usar `migration repair --reverted` no banco atual sem motivo explicito.
