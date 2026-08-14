# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-13, `main` apos PR #109; branch atual adiciona leitura automatica do valor total do PDF do W.Vetro no Kanban.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- No primeiro estagio do Kanban, qualquer pedido exige `Iniciar orçamento`; pedidos ja iniciados mostram `Retornar orçamento`.
- Fotos do pedido sao preservadas ao abrir o Kanban.
- PR #105: cada esquadria exibe `Fotos coletadas em campo` antes das medidas, com multiplas fotos e `Adicionar fotos` sem apagar as anteriores.
- PR #106: `foto_larguras_url` aparece como `LARGURA`, `foto_alturas_url` como `ALTURA` e fotos gerais ficam em `Outras fotos` sem duplicacao.
- PR #107: leitura por IA das fotos de LARGURA/ALTURA no Kanban, conversao para mm e preenchimento das seis medidas somente quando as tres leituras do eixo forem reconhecidas.
- PR #108: corrige a inversao Baixo/Cima da LARGURA observada em teste real; exemplo validado `Baixo 1790 / Meio 1791 / Cima 1789`. ALTURA permanece sem alteracao.
- PR #109: anexo do W.Vetro recebe titulo padrao `Orçamento W.Vetro (original)` e o botao `Anexar` fica liberado sem digitacao manual.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).
- Medicao Final V2 operacional (PRs #54, #55 e #56), incluindo checklist/fotos e link externo seguro.
- A rota autenticada `/api/medicao-final/ler-trena` usa visao por IA para interpretar fotos do visor da trena/medidor laser.
- Engenharia Fases 1 a 4 concluidas: entrada apos Medicao Final, conferencia tecnica e liberacao transacional para Producao.

## EM VALIDACAO NESTA BRANCH — TOTAL DO PDF W.VETRO
- Nova rota autenticada `POST /api/orcamento/ler-total-pdf` recebe o PDF no momento da selecao e usa `pdf-parse` para extrair o texto.
- O parser procura valor monetario proximo de `TOTAL` e tem fallback para layouts fragmentados do W.Vetro.
- Reconhece moeda brasileira (`2.716,84`) e internacional (`2716.84`).
- Ao anexar o PDF no Kanban, o campo `Valor total do orçamento` e preenchido automaticamente.
- O colaborador recebe a confirmacao visual do valor lido, por exemplo `R$ 2.716,84`.
- O campo permanece editavel como seguranca caso a leitura do PDF precise de correcao.
- PDF real de referencia `FRANCIS TESTE-977.pdf`: total esperado `R$ 2.716,84`.
- O PDF original do W.Vetro continua preservado como anexo.

## PROXIMOS AJUSTES VALIDADOS PELO USUARIO
1. Validar em producao que o PDF `FRANCIS TESTE-977.pdf` preenche `R$ 2.716,84`.
2. Formatar valores do PDF Atlas no padrao brasileiro (`R$ 2.716,84`).
3. Adicionar botao `Enviar ao vendedor` / `Reenviar` em cada anexo, sem depender da finalizacao unica.
4. Criar `Configurações -> Orçamento` para dados da empresa, validade, pagamento, prazo, garantia, observacoes e rodape.
5. Evoluir o PDF Atlas profissional a partir do modelo atual e depois aproximar do espelho W.Vetro.
6. Em etapa posterior, extrair itens/descricoes/condicoes do W.Vetro com revisao humana antes de gravar dados definitivos.

## ENGENHARIA — ESTADO REAL
- Fase 1 concluida: Medicao Final aprovada entra automaticamente na Engenharia.
- Fase 2 concluida: rota `/engenharia` e fluxo Recebidas -> Conferencia tecnica -> Em desenvolvimento -> Liberado para producao.
- Fase 3 concluida: conferencia tecnica persistente por peca e bloqueio de liberacao incompleta.
- Fase 4 concluida: liberacao transacional/idempotente Engenharia -> Producao.
- Ainda nao existe MEE/calculo tecnico automatico, receitas de tipologias, lista de corte ou otimizacao.

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

## ATUALIZACAO — MOEDA BRL E REENVIO DE ANEXOS
- Branch `fix/moeda-brl-reenvio-anexos`: corrige o uso de `.toFixed(2)` no card e no PDF Atlas; `2716.84` passa a ser exibido como `R$ 2.716,84`.
- O campo `Valor total do orçamento` usa mascara monetaria: digitando `271684`, exibe `R$ 2.716,84`; o valor continua numerico no banco.
- O PDF Atlas formata total e valores de itens no padrao brasileiro.
- Cada anexo em andamento recebe `Enviar`; anexos finalizados recebem `Reenviar`, abrindo o WhatsApp do vendedor com o link daquele arquivo sem exigir nova finalizacao.
- Fotos, leitura da trena, `Iniciar/Retornar orçamento` e parser do total W.Vetro nao foram alterados.
