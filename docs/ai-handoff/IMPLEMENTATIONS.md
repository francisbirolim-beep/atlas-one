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
Importacao direta em `Nova medicao`, suporte a PDFs sem dimensoes, preservacao do original e correcoes do parser.

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

## PR #129 — navegacao, orcamento/PDF e Plano de Corte — 2026-08-15
Mergeada em `main` no commit `91d4bd97167342dfb76ca24de53947d12a7a63d0`; status Vercel do commit: success.

Navegacao:
- lista diaria reduzida a Inicio, Clientes, Orcamentos, Kanban, Medicao Final, Producao e Engenharia;
- Sidebar/Favoritos simplificados;
- administracao separada para Master;
- topbar limpa e perfil/logout funcional.

Orcamento/PDF:
- `/configuracoes/orcamento` exclusiva para Master;
- titulo, validade, foto, preco unitario, assinatura, observacao e rodape configuraveis;
- PDF de Orcamento Balcao aplica o padrao salvo.

Plano de Corte V1:
- `/producao/plano-corte` e atalho em Producao junto da Medicao Final;
- pesquisa produtos `porta_janela_padrao`;
- usa receita tecnica da Engenharia;
- gera snapshot persistente/editavel sem alterar receita mestre;
- variaveis de medidas, folgas e configuracao tecnica;
- permite substituir perfil/acessorio, ajustar quantidade/unidade/corte;
- permissao: Master/edicao altera, consulta visualiza, oculto bloqueia;
- migration `20260815100000_plano_corte_producao_v1.sql` cria as tabelas do recurso.

Observacao operacional: a migration passou no dry-run da PR, mas o workflow de banco exige `workflow_dispatch` manual com `mode=apply` e confirmacao `APPLY_PRODUCTION`. Merge/deploy do frontend nao prova que a migration foi aplicada.

## Revisao pos-merge — base tecnica Porta de Correr 03 Folhas Suprema — 2026-08-15
Foi recuperado e analisado o material W.Vetro real da biblioteca do usuario, incluindo o relatorio do orcamento 866 e outras amostras do projeto `*SUCB-PC3-01EF`.

Criado `docs/tecnico/receitas/porta-correr-3f-suprema.md` com:
- perfis observados;
- variaveis do projeto;
- quatro amostras reais;
- formulas candidatas fortes de marco, montantes, baguete vertical, vidro e arremate;
- evidencia de que a largura da folha depende da variante de mao-de-amigo/reforco.

Decisao consolidada: o motor final de Plano de Corte deve ser orientado a **produto + receita mestre + variaveis + snapshot**. Uma unica receita/formula generica por `porta_correr` nao e suficiente para automatizacao segura.

## W.Vetro API — estado da integracao
A documentacao publica `Wvetro Integrations v2` foi localizada. Integracao live deve ser server-side e comecar somente leitura. Nao implementar payloads proprietarios por suposicao. Credenciais/ambiente de teste e schemas reais ainda sao prerequisitos.

## Pontos funcionais ainda pendentes
- confirmar/apply da migration do Plano de Corte em producao;
- validar Plano de Corte V1 no celular/desktop com banco ativo;
- evoluir schema de receitas para vinculo por produto/variantes mantendo fallback por tipologia;
- definir motor de formulas restrito e seguro;
- fechar receita real Porta de Correr 3F Suprema com mais amostras por variante e acessorios completos;
- validar Medicao Final em campo;
- validar PDF com configuracoes reais;
- iniciar W.Vetro somente leitura quando houver credenciais/schemas de teste;
- evoluir Plano de Corte para lista de barras, otimizacao, sobras e romaneio com desenho tecnico.
