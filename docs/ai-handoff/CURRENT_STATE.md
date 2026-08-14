# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-14. `main` esta no merge da PR #111 (`ff743db985257da3ebe9087810bbffa3d545b255`). A branch `feat/medicao-final-importar-wvetro` / PR #112 adiciona criacao de Medicao Final diretamente por PDF W.Vetro e esta aguardando validacao funcional real.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- No primeiro estagio do Kanban, qualquer pedido exige `Iniciar orçamento`; pedidos ja iniciados mostram `Retornar orçamento`.
- Fotos do pedido sao preservadas ao abrir o Kanban.
- PR #105: cada esquadria exibe `Fotos coletadas em campo` antes das medidas, com multiplas fotos e `Adicionar fotos` sem apagar as anteriores.
- PR #106: `foto_larguras_url` aparece como `LARGURA`, `foto_alturas_url` como `ALTURA` e fotos gerais ficam em `Outras fotos` sem duplicacao.
- PR #107: leitura por IA das fotos de LARGURA/ALTURA no Kanban, conversao para mm e preenchimento das seis medidas somente quando as tres leituras do eixo forem reconhecidas.
- PR #108: corrige a inversao Baixo/Cima da LARGURA observada em teste real; exemplo validado `Baixo 1790 / Meio 1791 / Cima 1789`. ALTURA permanece sem alteracao.
- PR #109: anexo W.Vetro recebe titulo padrao `Orçamento W.Vetro (original)` e o botao `Anexar` fica liberado sem digitacao manual.
- PR #110: leitura automatica do valor total do PDF W.Vetro no Kanban; referencia `FRANCIS TESTE-977.pdf` -> `R$ 2.716,84`.
- PR #111: card, campo e PDF Atlas usam formatacao BRL; cada anexo pode ser `Enviar`/`Reenviar` individualmente ao vendedor.
- App Shell responsivo com Sidebar + Topbar compartilhados.
- Infraestrutura canonica de migrations Supabase em `supabase/migrations/`.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).
- Medicao Final V2 operacional (PRs #54, #55 e #56), incluindo checklist/fotos e link externo seguro.
- A rota autenticada `/api/medicao-final/ler-trena` usa visao por IA para interpretar fotos do visor da trena/medidor laser.
- Engenharia Fases 1 a 4 concluidas: entrada apos Medicao Final, conferencia tecnica e liberacao transacional para Producao.
- Cadastro tecnico de linhas existe em `linhas_tecnicas`, com relacionamentos `linha_produtos` e `linha_tipologias`.

## EM VALIDACAO — PR #112: NOVA MEDICAO POR PDF W.VETRO
- No modal `Nova medição`, o fluxo existente de selecionar um orçamento vendido do Atlas continua disponivel.
- Foi adicionada a opcao `Importar orçamento W.Vetro` no mesmo modal.
- O PDF e enviado para a rota autenticada server-side `POST /api/medicao-final/importar-wvetro`; o browser nao interpreta nem grava os dados diretamente.
- A primeira chamada (`acao=preview`) usa `pdf-parse`, reconhece o documento e apresenta uma revisao antes de qualquer gravacao.
- O parser dedicado `lib/wvetroPdf.ts` tenta extrair numero do orçamento, cliente, cidade/UF, total e itens com ambiente, tipo, descricao, quantidade, largura, altura, cor, linha e vidro quando presentes no texto do PDF.
- Ambiente vazio no W.Vetro NAO invalida a importacao; a tela sinaliza `Ambiente não informado`.
- Cliente e cidade podem ser conferidos/corrigidos antes de confirmar.
- Na confirmacao, o Atlas preserva o PDF original no Storage, cria um orçamento de apoio e cria a Medicao Final vinculada a ele.
- As dimensoes do orçamento (ex.: `1789 x 1962`) sao gravadas no orçamento de apoio e exibidas na descricao da peca como `REFERÊNCIA ORÇAMENTO`.
- As 3 larguras e 3 alturas da Medicao Final permanecem vazias. O sistema NAO transforma medida comercial/orcamentaria em medida final.
- Se o numero W.Vetro for reconhecido, existe bloqueio de reimportacao do mesmo numero; se ja houver Medicao Final vinculada, a UI pode abrir a existente.
- PDF limitado a 15 MB; falhas intermediarias tentam remover registros/arquivo criados pela operacao.
- O primeiro Build Validation da PR #112 concluiu com sucesso em 2026-08-14 (run #82, job `Next.js build`).
- Ainda precisa de teste funcional em producao/preview com o PDF real `FRANCIS TESTE-977.pdf` antes de considerar o fluxo validado.

## W.VETRO API — OPORTUNIDADE MAPEADA, NAO IMPLEMENTADA
- A documentacao publica `Wvetro Integrations v2` e os endpoints enviados pelo usuario foram avaliados como potencial fonte estruturada para Atlas.
- Endpoints relevantes identificados incluem linhas, produto por chave, cores, vidros, pessoas/vendedores, metas, pedidos, orcamentos, compras/NF, itens de NF, estoque, financeiro, lotes, producao de projeto e instalacoes.
- Estrategia futura: preferir API W.Vetro -> JSON estruturado -> Atlas; manter leitura de PDF como fallback/documento original.
- Nao colocar credenciais W.Vetro no browser; futura integracao deve ser server-side.
- Ainda NAO foi confirmado endpoint publico para receitas/BOM, formulas de corte, usinagens, lista/plano de corte ou otimizacao de barras. Nao assumir que esses dados estao liberados pela API.

## ENGENHARIA — ESTADO REAL
- Fase 1 concluida: Medicao Final aprovada entra automaticamente na Engenharia.
- Fase 2 concluida: rota `/engenharia` e fluxo Recebidas -> Conferencia tecnica -> Em desenvolvimento -> Liberado para producao.
- Fase 3 concluida: conferencia tecnica persistente por peca e bloqueio de liberacao incompleta.
- Fase 4 concluida: liberacao transacional/idempotente Engenharia -> Producao.
- Ainda nao existe MEE/calculo tecnico automatico, receitas de tipologias, lista de corte ou otimizacao.

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- PR #112: importacao direta de PDF W.Vetro em `Nova medição`.
- Confirmacao de Venda Fase 1.
- Importacao generica de itens via PDF; layouts W.Vetro podem variar e precisam de validacao por amostras reais.
- Modulo de IA/agente existe, mas nao foi auditado a fundo.
- CRM existe no codigo; uso real nao confirmado nesta sessao.

## PARCIAL / DIVIDA TECNICA
- Entidade persistente `vendas`/`obras` ainda nao existe.
- Regras condicionais completas do checklist V2 e `exigir_foto_quando` ainda pendentes.
- O orçamento de apoio criado pela importacao direta W.Vetro ainda usa a estrutura atual de `orcamentos`; nao existe uma entidade propria de integracao W.Vetro.
- A futura integracao API deve preservar IDs/codigos externos e JSON bruto sem transformar W.Vetro na fonte da verdade do Atlas.
- Design System ainda nao foi aplicado em todas as telas antigas.
- `lib/calculos.ts` ainda nao usa categoria dinamica de tipologia em todas as formulas.
- Testes automatizados de regra de negocio ainda nao existem.

## SEGURANCA / MIGRATIONS
- Acesso externo da Medicao Final e server-side, com token-hash, validade e revogacao.
- Geracao/revogacao respeita permissoes do Atlas; Master tem edicao total.
- Importacao W.Vetro da PR #112 exige sessao Atlas valida no servidor.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
