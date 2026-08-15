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

## Medicao Final — medidas fixas e fotos da trena — PR #119 — 2026-08-14
- 3 larguras + 3 alturas fixas por peca;
- foto da trena da LARGURA e ALTURA;
- `medido=true` somente com as seis medidas positivas.

## Medicao Final — padroes SIM/NAO e vista interna — PR #120 — 2026-08-14
- CONTRAMARCO, ARREMATE, CADEIRINHA e CANTONEIRA com SIM/NAO por peca;
- observacao por peca;
- lembrete para medir pela vista interna do vao.

## Medicao Final — ordem do fluxo por peca — PR #121 — 2026-08-14
- tabela SIM/NAO logo abaixo das medidas finais;
- observacao logo depois;
- demais campos e fotos adicionais na sequencia.

## Medicao Final — parcial, tempo e historico — PR #122 — 2026-08-14
- cronometro de tempo ativo apos inicio;
- `Salvar medição parcial` pausa sem apagar dados;
- `Retomar medição` continua a mesma medicao;
- cada peca mostra `✅ FEITA` ou `EM ABERTO`;
- historico registra inicio, parcial e retomada.

## Navegacao mobile — Favoritos — PR #123 — 2026-08-14
- remove barra inferior extensa no celular;
- cria botao compacto `Favoritos`;
- permite favoritar/desfavoritar paginas e setores;
- Home ganha bloco `Acesso rápido / Favoritos`.

## Navegacao mobile — Voltar e Inicio — PR #124 — 2026-08-14
- fora da Home mostra `Voltar` e `Inicio`;
- `Voltar` usa historico com fallback para `/`;
- Favoritos permanece independente.

## Medicao Final — remover duplicata generica — PR #125 — 2026-08-14
- confirma `/producao/medicao-final` como unica Medicao Final oficial;
- filtra a entrada generica/legada das listas globais;
- remove duplicata de Favoritos, Setores e Sidebar.

## Home — limpeza de atalhos — PR #126 — 2026-08-14
- remove do hero `Medições finais` e `Abrir operação`;
- mantem `Novo orçamento` como unica acao principal;
- esconde `Inicio` flutuante na propria Home.

## Home — limpeza operacional — branch `fix/limpeza-home-operacional` — 2026-08-14
- remove da Home o bloco duplicado `Atenção necessária / Ações rápidas`;
- deixa de renderizar na Home a agenda/calendario/tarefas legadas de `app/page.tsx`;
- preserva essas funcionalidades em suas rotas proprias;
- Home passa a mostrar somente Hero, Favoritos e Resumo da operação;
- remove `Ver relatórios` do resumo central;
- nenhuma rota, dado ou migration removidos.

## W.Vetro API — levantamento de integracao — 2026-08-14
Endpoints mapeados para autenticacao, linhas, produto por chave, cores, vidros, pessoas/vendedores, metas, pedidos/orcamentos, compras/NF, estoque, financeiro, lotes, producao e instalacoes. Futura integracao deve ser server-side e Atlas continua fonte da verdade.

## Pontos funcionais ainda pendentes
- Validar a Home operacional limpa no iPhone.
- Validar Medicao Final em campo: parcial, tempo, historico, SIM/NAO, medidas e fotos.
- Replicar parcial/campos fixos no link externo se necessario.
- Criar `Configurações -> Orçamento` e PDF Atlas profissional.
- Criar conector W.Vetro API somente leitura depois de credenciais/testes reais.
- Engenharia Fase 5: receitas tecnicas, MEE, lista de materiais, lista de corte e otimizacao.
