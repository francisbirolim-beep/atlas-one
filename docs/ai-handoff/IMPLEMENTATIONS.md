# IMPLEMENTATIONS.md — Atlas One (cronologico, resumido)

Lista resumida das implementacoes relevantes. Para estado real usar CURRENT_STATE.md; para proxima tarefa usar NEXT_TASK.md.

## Base funcional
Cadastros, Kanban de orcamentos, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes. Status: em uso.

## Infraestrutura Supabase / migrations — 2026-08-11
Session Pooler IPv4, audit/dry-run em PR, historico local/remoto reconciliado e migrations operacionais controladas.

## Medicao Final V2 — PRs #54 a #56
- #54: responsavel, status operacional, liberar/iniciar/concluir/aprovar, pendencias e bloqueios.
- #55: checklist normalizado por peca/tipologia/secao, respostas e fotos categorizadas.
- #56: link externo seguro com token-hash, expiracao/revogacao, medidas, checklist, fotos e conclusao para revisao.

## Build Validation — GitHub Actions
Workflow de `npm install` + `npm run build` para validar compilacao/TypeScript independentemente da Vercel.

## Redesign profissional — PRs #57 a #63
Home executiva, Sidebar, Kanban Comercial, Central/Pesquisa de Orcamentos, Medicao Final, Producao e base profissional para setores.

## Engenharia Fases 1 a 4 — PRs #64, #66, #69 e #73
Entrada automatica apos Medicao Final aprovada, rota `/engenharia`, conferencia tecnica e liberacao transacional/idempotente para Producao.

## Kanban — fotos e trena — PRs #104 a #108 — 2026-08-13
- fotos de campo e identificacao LARGURA/ALTURA;
- leitura por IA da trena/laser;
- #108 corrige inversao Baixo/Cima da largura em teste real.

## Kanban — W.Vetro, total e moeda — PRs #109 a #111 — 2026-08-13
Anexo W.Vetro original, leitura automatica do total, moeda BRL e envio/reenvio individual de anexos.

## Medicao Final — importacao W.Vetro — PRs #112 a #118 — 2026-08-14
- #112: importar PDF W.Vetro em `Nova medição`, preview, preservacao do original e criacao da Medicao Final;
- #113: aceita PDFs sem largura/altura sem inventar dimensoes;
- #114: Cliente/Obra/Orçamento, telefone do responsavel e dados da empresa somente manuais;
- #115: primeira correcao de Cliente/Cidade no PDF 861;
- #116: reaproveita apoio W.Vetro antigo sem Medicao Final;
- #117: apoios W.Vetro deixam de aparecer no seletor Atlas;
- #118: rejeita rotulos concatenados como `CELULARTEL. FIXO:`; teste confirmou FELIPE ALVES SANTANA, JOSE BONIFACIO - SP e 7 itens.

## Medicao Final — medidas fixas e fotos da trena — PR #119 — 2026-08-14
- bloco fixo por peça com Largura Baixo/Meio/Cima e Altura Direita/Meio/Esquerda;
- foto da trena da LARGURA e ALTURA;
- `medido=true` somente com as seis medidas positivas;
- orçamento Atlas `tipo_medida=final` pode fornecer medidas/fotos ja existentes, sem inventar ou sobrescrever valores;
- merge `f995a9377430e7f1344e00c6acf86799da44b2c2`.

## Medicao Final — padroes SIM/NAO, observacao e vista interna — PR #120 — 2026-08-14
- adiciona `MedicaoPadroesFixosPanel` para todas as peças da tela interna;
- CONTRAMARCO, ARREMATE, CADEIRINHA e CANTONEIRA sempre disponiveis com SIM/NAO;
- valores persistidos em `medicao_itens.campos_extras`, preservando demais chaves;
- campo OBSERVACAO sempre disponivel no final de cada peça (`observacao_medicao`);
- aviso permanente: medir pela vista interna do vao;
- quando a medicao esta liberada e ainda nao iniciada, modal reforca a regra antes do inicio;
- nao altera medidas finais, fotos da trena nem checklist configuravel;
- branch `feat/medicao-padrao-sim-nao-observacao`, em validacao.

## W.Vetro API — levantamento de integracao — 2026-08-14
Endpoints mapeados para autenticacao, linhas, produto por chave, cores, vidros, pessoas/vendedores, metas, pedidos/orcamentos, compras/NF, estoque, financeiro, lotes, producao e instalacoes. Futura integracao deve ser server-side e Atlas continua fonte da verdade.

## Pontos funcionais ainda pendentes
- Validar visualmente PR #120: SIM/NAO, persistencia e observacao por peça.
- Validar o modal de vista interna apos liberar uma medicao ainda nao iniciada.
- Validar PR #119 em campo: seis medidas, fotos e heranca de orçamento `tipo_medida=final`.
- Decidir/implementar os mesmos campos fixos no link externo se ele for usado como interface principal do medidor.
- Validar faixa Cliente/Obra/Orçamento e telefone automatico.
- Criar `Configurações -> Orçamento` e PDF Atlas profissional.
- Criar conector W.Vetro API somente leitura depois de credenciais/testes reais.
- Engenharia Fase 5: receitas tecnicas, MEE, lista de materiais, lista de corte e otimizacao.
