# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-13, `main` apos PR #108; branch atual prepara o anexo original do W.Vetro no Kanban.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- No primeiro estagio do Kanban, qualquer pedido exige `Iniciar orçamento`; pedidos ja iniciados mostram `Retornar orçamento`.
- Fotos do pedido sao preservadas ao abrir o Kanban.
- PR #105: cada esquadria exibe `Fotos coletadas em campo` antes das medidas, com multiplas fotos e `Adicionar fotos` sem apagar as anteriores.
- PR #106: `foto_larguras_url` aparece como `LARGURA`, `foto_alturas_url` como `ALTURA` e fotos gerais ficam em `Outras fotos` sem duplicacao.
- PR #107: leitura por IA das fotos de LARGURA/ALTURA no Kanban, conversao para mm e preenchimento das seis medidas somente quando as tres leituras do eixo forem reconhecidas.
- PR #108: corrige a inversao Baixo/Cima da LARGURA observada em teste real; exemplo validado `Baixo 1790 / Meio 1791 / Cima 1789`. ALTURA permanece sem alteracao.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).
- Medicao Final V2 operacional (PRs #54, #55 e #56), incluindo checklist/fotos e link externo seguro.
- A rota autenticada `/api/medicao-final/ler-trena` usa visao por IA para interpretar fotos do visor da trena/medidor laser.
- Engenharia Fases 1 a 4 concluidas: entrada apos Medicao Final, conferencia tecnica e liberacao transacional para Producao.

## EM VALIDACAO NESTA BRANCH — ANEXO W.VETRO
- O bloco `Anexos do orçamento` ja usa `uploadArquivo` e persiste os anexos em `orcamentos.anexos` quando o orcamento e salvo/finalizado.
- O bloqueio atual e de interface: o input de arquivo fica desabilitado enquanto `novoAnexoTitulo` estiver vazio.
- Nesta branch, ao abrir o Kanban, o campo de titulo do anexo recebe automaticamente `Orçamento W.Vetro (original)` quando estiver vazio, liberando imediatamente o botao `Anexar` sem exigir digitacao manual.
- O PDF original do W.Vetro continua sendo preservado como anexo; ainda nao existe leitura/espelhamento automatico desse PDF nesta etapa.
- O titulo padronizado identifica qual anexo sera a fonte da proxima etapa: gerar um PDF Atlas espelho do W.Vetro para envio ao vendedor.

## PROXIMO PASSO VALIDADO PELO USUARIO
1. Validar upload do PDF W.Vetro no Kanban sem precisar digitar titulo.
2. Preservar o PDF original anexado.
3. Criar fluxo de leitura estruturada do PDF W.Vetro.
4. Montar uma tela de revisao dos itens lidos antes de gerar documento final.
5. Gerar um `Orçamento Atlas` em PDF com o mesmo conteudo comercial do W.Vetro (espelho), usando identidade da Esquadrifacio.
6. Na finalizacao, disponibilizar o PDF Atlas para o vendedor e manter o W.Vetro original como fonte/auditoria.

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
