# IMPLEMENTATIONS.md — Atlas One (cronologico, resumido)

Lista resumida das implementacoes relevantes, da mais antiga para a mais recente. Para detalhes de arquitetura ver ARCHITECTURE.md; para o que esta funcionando de fato ver CURRENT_STATE.md.

## Cadastro base (clientes, produtos, fornecedores)
Objetivo: cadastro completo de clientes (com endereco/contato), produtos e fornecedores. Status: concluido.

## Kanban de orcamentos
Objetivo: quadro kanban para acompanhar orcamentos por coluna, com historico e automacoes. Status: concluido e em uso.

## Medicao Final
Objetivo: apos venda confirmada, permitir medir cada esquadria fisicamente, com quadro proprio e checklist por tipologia. Status: em uso e evoluindo.

## Importacao de itens via PDF
Objetivo: ler PDF de orcamento e gerar itens. Status: existe no codigo, mas a heuristica ainda nao cobre com confiabilidade todos os PDFs reais W.Vetro. Nao deve liberar processo sem conferencia.

## Checklist de medicao
Campos configuraveis por tipologia, obrigatorios, numero/texto/foto, marcacao medido/reabrir. Status: concluido.

## Tipologias dinamicas (PR #28)
Tabela `tipologias`, CRUD e telas dinamicas. Status: concluido e mergeado. Limitacao: categoria porta/janela ainda nao conectada a lib/calculos.ts.

## Automacao Kanban -> Medicao Final
PR #30 implementou criacao automatica ao entrar em coluna `gera_medicao_final=true`. Posteriormente essa decisao foi revista porque a operacao precisa validar cliente, proposta fechada e itens antes de criar qualquer processo.

## Leitura de PDF na Medicao Final
PR #31 ampliou o parser/importacao e sincronizacao do PDF. A leitura ainda falha em layouts reais especificos; a estrategia foi alterada para transformar o PDF em dados estruturados e conferiveis antes da operacao.

## Exclusao Master da Medicao Final
PRs #32/#33: Master pode excluir Medicao Final e limpar cards derivados pelo mesmo `orcamento_id`, preservando o orcamento original e cliente.

## Confirmacao de Venda — Fase 1
Objetivo: impedir que arrastar para `Vendido` gere processos incompletos.

Implementado:
- `lib/kanban.ts`: colunas com `gera_medicao_final=true` passam a abrir a Confirmacao de Venda e nao executam fan-out/Medicao automaticamente;
- `app/vendas/confirmar/page.tsx`: nova tela em 4 etapas (cadastro, escolha do orcamento, conferencia dos itens, iniciar processo);
- `lib/vendas.ts`: carrega cliente/orcamentos, valida e salva cadastro completo, bloqueia venda sem itens estruturados, cria/reutiliza Medicao Final e dispara automacoes somente no clique `Iniciar processo da venda`;
- cliente com varios orcamentos pode escolher explicitamente qual proposta foi fechada.

Status: implementado; manter validacao funcional antes de considerar fluxo definitivo.

## App Shell e Home executiva (PRs #45 a #48)
Objetivo: dar ao Atlas aparencia consistente de ERP e criar uma Home de gestao real.

Implementado e mergeado em main:
- AppShell compartilhado;
- Topbar responsiva;
- componentes reutilizaveis de sistema;
- indicadores de gestao;
- alertas operacionais e acoes rapidas;
- agenda e produtividade na Home.

## Atlas One Definitivo — Shell visual v2 (branch feat/atlas-shell-definitivo-v2)
Objetivo: aproximar a interface real da direcao visual escolhida para o Atlas One (ERP industrial moderno + SaaS + operacao + engenharia).

Implementado nesta etapa:
- Topbar com busca global em destaque;
- botao `+ Novo` ligado ao Orcamento Rapido;
- entrada visual para `IA Atlas`;
- notificacoes e perfil reorganizados;
- base global de tipografia, foco e selecao;
- nenhuma mudanca de regra de negocio ou banco.

Status: branch aberta para PR/preview. Proxima aplicacao visual recomendada: Medicao Final.

## Proxima evolucao funcional
Fase 2: converter PDF W.Vetro em um `Orçamento Atlas` estruturado, editavel e conferivel. O PDF original fica como origem; futuramente o PDF do Atlas passa a ser a saida oficial gerada dos dados estruturados.
