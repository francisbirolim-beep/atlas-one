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

## Navegacao operacional essencial — branch `feat/limpeza-e-fluxo-operacional` — 2026-08-15
- lista diaria reduzida a Inicio, Clientes, Orcamentos, Kanban, Medicao Final, Producao e Engenharia;
- Sidebar desktop simplificada;
- administracao separada para Master;
- Favoritos mobile mostra apenas areas essenciais;
- topbar remove botoes sem funcao real e perfil ganha menu funcional/logout.

## Configuracoes -> Orcamento e PDF — branch `feat/limpeza-e-fluxo-operacional` — 2026-08-15
- nova rota `/configuracoes/orcamento` exclusiva para Master;
- usa `configuracoes_gerais`, sem migration;
- configura titulo, validade, foto, preco unitario, assinatura, observacao e rodape;
- validade padrao = 7 dias;
- PDF de Orcamento Balcao aplica o padrao salvo.

## Producao -> Plano de Corte V1 — branch `feat/limpeza-e-fluxo-operacional` — 2026-08-15
- nova rota `/producao/plano-corte` e novo atalho no setor Producao ao lado da Medicao Final;
- pesquisa produtos cadastrados como `porta_janela_padrao`;
- seleciona uma tipologia com receita tecnica da Engenharia;
- gera snapshot persistente e editavel da receita para cada plano, sem alterar a receita mestre;
- variaveis: largura, altura, quantidade, folgas, linha, folhas, montagem, trilho, contramarco, arremate, fechadura, puxador, mao amiga, travessas e roldana;
- permite substituir perfil/acessorio por produto tecnico cadastrado, ajustar quantidade, unidade e corte final;
- formulas da receita sao exibidas; resultado automatico so deve existir depois de validacao da formula real da tipologia;
- permissao segue o setor Producao: Master/edicao podem alterar; consulta apenas visualiza; oculto bloqueia;
- migration cria `planos_corte` e `plano_corte_componentes`.

## W.Vetro API — estado da integracao
A documentacao publica `Wvetro Integrations v2` foi localizada. Integracao live deve ser server-side e comecar somente leitura. Nao implementar payloads proprietarios por suposicao. Credenciais/ambiente de teste e schemas reais ainda sao prerequisitos.

## Vercel — limite temporario
- Hobby atingiu limite diario de deployments (>100/24h);
- PR #128 de retry foi fechada sem merge;
- trabalho atual fica agrupado na PR #129 ate a janela liberar.

## Pontos funcionais ainda pendentes
- validar PR #129 no Build Validation apos cada bloco relevante;
- validar visualmente menu/favoritos/configuracao de orcamento/Plano de Corte quando houver Preview/Deploy;
- cadastrar e validar receitas reais por tipologia para ativar calculos automaticos de corte;
- validar Medicao Final em campo;
- validar PDF com configuracoes reais;
- iniciar W.Vetro somente leitura quando houver credenciais/schemas de teste;
- evoluir Plano de Corte para lista de barras, otimizacao de barras e impressao/romaneio depois das formulas validadas.
