# IMPLEMENTATIONS.md — Atlas One (cronologico, resumido)

Lista resumida das implementacoes relevantes. Para estado real usar CURRENT_STATE.md; para proxima tarefa usar NEXT_TASK.md.

## Cadastro base / Kanban / Orcamentos
Cadastro de clientes, produtos e fornecedores; Kanban de orcamentos; Orcamento Rapido e Balcao. Status: em uso.

## Medicao Final legado
Fluxo por tipologia com 3 larguras, 3 alturas, fotos, campos extras configuraveis e medir/reabrir item. Status: preservado por compatibilidade.

## Tipologias dinamicas
Tabela e CRUD de tipologias dinamicas. Status: mergeado. Limitacao conhecida: categoria dinamica ainda nao esta totalmente conectada a `lib/calculos.ts`.

## Confirmacao de Venda — Fase 1
Foi removida a criacao operacional automatica apenas pelo drag-and-drop em `Vendido`. A tela `/vendas/confirmar` exige cadastro completo, escolha do orcamento fechado e itens estruturados antes de iniciar o processo. Status: implementado; validacao funcional completa ainda pendente.

## App Shell e Home executiva
AppShell, Topbar, componentes de sistema, Home com indicadores, alertas, acoes rapidas e agenda. Status: mergeado.

## Infraestrutura Supabase / migrations — 2026-08-11
- Session Pooler IPv4 usado explicitamente por `--db-url`;
- workflow audita historico e executa dry-run em PR;
- migrations remotas antigas recuperadas com `supabase migration fetch` e versionadas;
- historico local/remoto reconciliado sem `migration repair --reverted`;
- PR #52 mergeado.

## Migration V20 — Medicao Final V2 — 2026-08-11
`20260811110000_medicao_final_v2.sql` aplicada no Supabase e validada. Adicionou status operacional, responsavel, pendencias, fotos, respostas, regras de campos, acessos externos e revisoes.

## Medicao Final V2 operacional — PR #54
Mergeado:
- responsavel no nivel da medicao;
- fluxo aguardando/liberado/em medicao/com pendencia/concluido/aprovado;
- liberar, iniciar, concluir e aprovar;
- criar/resolver pendencias;
- bloqueios de conclusao.

## Checklist e fotos V2 — PR #55
Mergeado apos build valido no GitHub Actions:
- respostas em `medicao_respostas`;
- sincronizacao com `medicao_itens.campos_extras`;
- checklist por peca/tipologia/secao;
- numero/texto/foto/opcoes configuradas;
- progresso de obrigatorios;
- fotos categorizadas em `medicao_fotos`;
- integracao sem reescrever a tela legada.

## Link externo seguro da Medicao Final — PR #56
Mergeado:
- token aleatorio forte armazenado somente como SHA-256;
- validade e revogacao;
- primeiro/ultimo acesso;
- pagina publica mobile sem AppShell;
- iniciar medicao, salvar 3 larguras + 3 alturas, checklist e fotos;
- conclusao envia para revisao interna;
- escrita externa bloqueada apos conclusao;
- geracao/revogacao interna respeita permissoes; Master tem edicao total.

## Build Validation — GitHub Actions
Criado workflow de validacao Next.js para executar instalacao de dependencias e `npm run build`. Foi necessario porque a Vercel passou a bloquear novos builds por limite diario da conta gratuita. O workflow valida compilacao, TypeScript e geracao/coleta de rotas sem usar segredos reais.

## Redesign profissional — PR #57
Mergeado:
- Home executiva;
- Topbar corporativa;
- workspace visual consistente;
- KPIs em padrao de ERP.

## Sidebar profissional — PR #58
Mergeado:
- navegacao desktop escura em padrao ERP;
- estilização isolada em `atlas-professional.css`;
- logica de favoritos, ordenacao, categorias, setores, permissoes e menu mobile preservada.

## Kanban Comercial profissional — PR #59
Mergeado:
- cabecalho legado ocultado dentro do AppShell;
- filtros agrupados;
- colunas/cards refinados;
- modais e responsividade modernizados;
- drag-and-drop e automacoes preservados.

## Central de Orcamentos profissional — PR #60
Mergeado:
- `/orcamento` redesenhado como Central de Orcamentos;
- atalhos para detalhado, rapido, pesquisa e pipeline;
- `/orcamento/pesquisar` integrado ao Professional Shell;
- nenhuma formula, regra de preco ou persistencia alterada.

## Medicao Final profissional — PR #61
Branch `feat/atlas-professional-medicao-final-v1`; Build Validation passou.

Implementado:
- painéis V2 agrupados em `atlas-medicao-tools`;
- folha visual isolada `app/atlas-medicao-professional.css`;
- hierarquia visual refinada para progresso/status, acesso externo e checklist;
- melhor adaptacao desktop/mobile;
- tela legada abaixo dos painéis aproximada visualmente do novo Design System;
- nenhuma regra V2 alterada.

## Proximas evolucoes recomendadas
1. mergear PR #61 apos revisao final;
2. aplicar Design System em Producao;
3. aplicar Design System em Engenharia;
4. validar funcionalmente Confirmacao de Venda Fase 1;
5. definir motor simples de regras condicionais/foto obrigatoria do checklist;
6. criar liberacao persistente para Engenharia apos aprovacao;
7. continuar Fase 2 PDF W.Vetro -> Orcamento Atlas estruturado e conferivel.
