# IMPLEMENTATIONS.md — Atlas One (cronologico, resumido)

Lista resumida das implementacoes relevantes. Para estado real usar CURRENT_STATE.md; para proxima tarefa usar NEXT_TASK.md.

## Base funcional
Cadastros, Kanban de orcamentos, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes. Status: em uso.

## Infraestrutura Supabase / migrations — 2026-08-11
Session Pooler IPv4, audit/dry-run em PR, historico local/remoto reconciliado e migrations operacionais controladas.

## Medicao Final V2 — PRs #54 a #56
- responsavel, status operacional, liberar/iniciar/concluir/aprovar, pendencias e bloqueios;
- checklist normalizado por peca/tipologia/secao, respostas e fotos categorizadas;
- link externo seguro com token-hash, expiracao/revogacao, medidas, checklist, fotos e conclusao para revisao.

## Build Validation — GitHub Actions
Workflow de `npm install` + `npm run build` para validar compilacao/TypeScript independentemente da Vercel.

## Redesign profissional — PRs #57 a #63
Home executiva, Sidebar, Kanban Comercial, Central/Pesquisa de Orcamentos, Medicao Final, Producao e base profissional para setores.

## Engenharia Fases 1 a 4 — PRs #64, #66, #69 e #73
Entrada automatica apos Medicao Final aprovada, rota `/engenharia`, conferencia tecnica e liberacao transacional/idempotente para Producao.

## Kanban — fotos, trena e W.Vetro — PRs #104 a #111 — 2026-08-13
Fotos de campo, leitura por IA da trena, correcao Baixo/Cima, anexo W.Vetro original, leitura automatica do total, moeda BRL e envio/reenvio individual.

## Medicao Final — importacao W.Vetro — PRs #112 a #118 — 2026-08-14
Importacao direta em `Nova medição`, suporte a PDFs sem dimensoes, preservacao do original e correcoes do parser.

## Medicao Final — medidas e fluxo — PRs #119 a #122 — 2026-08-14
- 3 larguras + 3 alturas fixas por peca;
- foto da trena da LARGURA e ALTURA;
- CONTRAMARCO, ARREMATE, CADEIRINHA e CANTONEIRA SIM/NAO;
- observacao por peca e lembrete da vista interna;
- ordem por peca validada;
- medicao parcial, cronometro ativo, historico de pausa/retomada e status FEITA/EM ABERTO.

## Navegacao mobile — PRs #123 e #124 — 2026-08-14
- remove barra inferior extensa no celular;
- cria Favoritos;
- adiciona Voltar e Inicio nas telas internas.

## Medicao Final — remover duplicata generica — PR #125 — 2026-08-14
- confirma `/producao/medicao-final` como unica Medicao Final oficial;
- retira a entrada generica/legada da navegacao.

## Home — limpeza — PRs #126 e #127 — 2026-08-14
- hero fica com `Novo orçamento` como acao principal;
- remove atalhos redundantes;
- Home passa a mostrar Hero, Favoritos e Resumo da operacao;
- agenda/tarefas/calendario e acoes duplicadas deixam de poluir a Home, sem excluir rotas ou dados.

## Navegacao operacional essencial — branch `feat/limpeza-e-fluxo-operacional` — 2026-08-14
- lista diaria reduzida a Inicio, Clientes, Orcamentos, Kanban, Medicao Final, Producao e Engenharia;
- Sidebar desktop simplificada, sem setores dinamicos misturados ao fluxo diario;
- administracao separada para Master;
- Favoritos mobile mostra apenas areas essenciais e oferece secao administrativa separada para Master;
- remove da topbar botoes sem funcao real (`IA Atlas` e notificacoes);
- perfil da topbar passa a abrir menu funcional com logout/configuracoes;
- paginas antigas continuam acessiveis por URL quando necessario; nenhuma exclusao destrutiva nesta etapa.

## Configuracoes -> Orcamento e PDF — branch `feat/limpeza-e-fluxo-operacional` — 2026-08-14
- nova rota `/configuracoes/orcamento`, exclusiva para Master;
- usa a tabela existente `configuracoes_gerais`, chave `configuracao_orcamento`; sem migration;
- permite configurar titulo do documento, validade, foto, preco unitario, assinatura, observacao padrao e rodape;
- validade padrao = 7 dias;
- `pdfOrcamentoBalcao` aplica titulo/validade/assinatura/rodape;
- novo Orcamento Balcao carrega as configuracoes e usa o padrao no PDF.

## W.Vetro API — estado da integracao
A documentacao publica `Wvetro Integrations v2` foi localizada. O escopo conhecido inclui autenticacao, linhas, produtos, cores, vidros, pessoas/vendedores, vendas/orcamentos, compras, estoque, financeiro, producao e instalacoes. A integracao live deve ser server-side e comecar somente leitura. Nao implementar payloads proprietarios por suposicao. Credenciais/ambiente de teste e schemas reais ainda sao prerequisitos para validar chamadas.

## Vercel — limite temporario
- Hobby atingiu limite diario de deployments (>100/24h);
- PR #128 de retry foi fechada sem merge;
- trabalho atual deve ser agrupado em uma unica PR e nao mergeado para producao ate a janela liberar, salvo decisao explicita.

## Pontos funcionais ainda pendentes
- rodar Build Validation da branch atual;
- validar visualmente menu/favoritos/configuracao de orcamento quando houver Preview/Deploy disponivel;
- validar Medicao Final em campo: parcial, tempo, historico, SIM/NAO, medidas e fotos;
- validar PDF de orcamento Balcao com configuracoes reais da empresa;
- iniciar conector W.Vetro somente leitura quando houver credenciais/schemas de teste;
- Engenharia Fase 5: receitas tecnicas, MEE, lista de materiais, lista de corte e otimizacao.
