# IMPLEMENTATIONS.md — Atlas One (cronologico, resumido)

Lista resumida das implementacoes relevantes. Para estado real usar CURRENT_STATE.md; para proxima tarefa usar NEXT_TASK.md.

## Cadastro base / Kanban / Orcamentos
Cadastro de clientes, produtos e fornecedores; Kanban de orcamentos; Orcamento Rapido e Balcao. Status: em uso.

## Medicao Final legado
Fluxo por tipologia com 3 larguras, 3 alturas, fotos, campos extras configuraveis e medir/reabrir item. Status: em uso e preservado por compatibilidade.

## Tipologias dinamicas
Tabela e CRUD de tipologias dinamicas. Status: mergeado. Limitacao conhecida: categoria dinamica ainda nao esta totalmente conectada a `lib/calculos.ts`.

## Confirmacao de Venda — Fase 1
Foi removida a criacao operacional automatica apenas pelo drag-and-drop em `Vendido`. A tela `/vendas/confirmar` exige cadastro completo, escolha do orcamento fechado e itens estruturados antes de iniciar o processo. Status: implementado; validacao funcional completa ainda pendente.

## App Shell e Home executiva
AppShell, Topbar, componentes de sistema, Home com indicadores, alertas, acoes rapidas e agenda. Status: mergeado.

## Medicao Final V2 — base visual e progresso
Detalhe mobile-first, resumo operacional por quantidade de pecas, identificacao de medidores e separacao explicita de unidades nao medidas. Itens agrupados ja medidos nao sao reinterpretados automaticamente. Status: mergeado.

## Infraestrutura Supabase / migrations — 2026-08-11
Problema encontrado: o GitHub Actions nao conseguia usar a conexao direta por ausencia de IPv6 e o pooler automatico apresentava falha de autenticacao.

Solucao definitiva:
- Session Pooler IPv4 usado explicitamente por `--db-url`;
- workflow audita historico e executa dry-run em PR;
- migrations remotas antigas foram recuperadas com `supabase migration fetch` e versionadas em `supabase/migrations/`;
- historico local/remoto reconciliado sem usar `migration repair --reverted`;
- PR #52 mergeado.

## Migration V20 — Medicao Final V2 — 2026-08-11
`20260811110000_medicao_final_v2.sql` foi aplicada no Supabase e validada. O dry-run posterior retornou banco atualizado.

A V20 adiciona:
- status operacional/responsavel/aprovacao/versionamento em `medicoes_finais`;
- `medicao_pendencias`;
- `medicao_fotos`;
- `medicao_respostas`;
- evolucao de `tipologia_campos_extras` com secao/opcoes/regras;
- `medicao_acessos_externos` com RLS sem policy permissiva;
- `medicao_revisoes`.

## Medicao Final V2 operacional — PR #54
Implementado e mergeado:
- responsavel no nivel da medicao;
- fluxo aguardando/liberado/em medicao/com pendencia/concluido/aprovado;
- liberar, iniciar, concluir e aprovar;
- criar/resolver pendencias;
- bloqueio de conclusao com unidades agrupadas, pecas nao medidas ou pendencias abertas.

## Checklist e fotos V2 — PR #55
Branch `feat/medicao-final-v2-checklist`.

Implementado no codigo:
- persistencia normalizada de respostas em `medicao_respostas`;
- sincronizacao de compatibilidade com `medicao_itens.campos_extras`;
- painel de checklist por peca/tipologia e por secao;
- campos numero/texto/foto;
- opcoes configuradas renderizadas como selecao rapida;
- progresso dos campos obrigatorios por peca;
- fotos categorizadas por peca em `medicao_fotos`;
- galeria e remocao de fotos;
- integracao via AppShell sem reescrever a tela legada.

Status de validacao: PR #55 aberto. O deploy da Vercel foi bloqueado por `build-rate-limit`, antes da compilacao. Nao mergear ate obter um build Vercel valido.

## Proximas evolucoes recomendadas
1. obter build valido e mergear PR #55;
2. validar o checklist V2 em uma medicao real;
3. definir e implementar motor simples de regras condicionais/foto obrigatoria do checklist;
4. criar link externo seguro por Route Handler server-side usando token-hash;
5. criar liberacao persistente para Engenharia apos aprovacao;
6. continuar Fase 2 da Confirmacao de Venda: PDF W.Vetro -> Orçamento Atlas estruturado e conferivel.
