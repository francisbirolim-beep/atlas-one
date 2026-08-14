# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-14. `main` esta no merge da PR #119 (`f995a9377430e7f1344e00c6acf86799da44b2c2`). A branch atual `feat/medicao-padrao-sim-nao-observacao` / PR #120 adiciona conferencias fixas SIM/NAO, observacao por peca e lembrete de vista interna do vao.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- PRs #105 a #108: fotos de campo, identificacao LARGURA/ALTURA, leitura por IA da trena/laser e correcao Baixo/Cima da largura.
- PRs #109 a #111: anexo W.Vetro original, leitura automatica do total, moeda BRL e envio/reenvio individual de anexos.
- PR #112: `Nova medição` permite importar PDF W.Vetro, revisar e criar a Medicao Final preservando o PDF original.
- PR #113: PDFs W.Vetro sem largura/altura deixam de ser rejeitados; nenhuma dimensao e inventada.
- PR #114: faixa Cliente/Obra/Orçamento; telefone do responsavel pelo WhatsApp cadastrado; dados da empresa somente quando salvos manualmente.
- PRs #115 a #118: correcao progressiva do parser W.Vetro; teste real do PDF 861 confirmou Cliente `FELIPE ALVES SANTANA`, Cidade `JOSE BONIFACIO - SP`, 7 itens.
- PR #119: toda peça da Medicao Final mostra sempre 3 larguras, 3 alturas, foto da trena de LARGURA e foto da trena de ALTURA; `medido=true` somente quando as seis medidas sao positivas; heranca de medidas/fotos somente de orçamento Atlas `tipo_medida=final`, sem inventar nem sobrescrever valores.
- Medicao Final V2 operacional, com status, responsavel, pendencias, checklist/fotos e link externo seguro.
- Engenharia Fases 1 a 4 concluidas.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).

## EM VALIDACAO — PR #120 — PADROES FIXOS DA MEDICAO
Pedido do usuario: todas as pecas da Medicao Final devem ter sempre, independente do checklist configuravel:
- CONTRAMARCO — SIM / NAO;
- ARREMATE — SIM / NAO;
- CADEIRINHA — SIM / NAO;
- CANTONEIRA — SIM / NAO;
- campo OBSERVACAO no final da peca.

Implementado em `MedicaoPadroesFixosPanel`:
- bloco separado e fixo por peca;
- selecao rapida SIM/NAO com persistencia em `medicao_itens.campos_extras`;
- chaves: `padrao_contramarco`, `padrao_arremate`, `padrao_cadeirinha`, `padrao_cantoneira`;
- observacao persistida em `observacao_medicao` dentro de `campos_extras`;
- preserva todos os outros valores ja existentes em `campos_extras`;
- aviso permanente: `Sempre fazer a medição pela vista interna do vão`;
- quando a medicao esta `liberado` e ainda sem `iniciado_em`, um modal reforca a vista interna antes do inicio;
- nao altera as seis medidas finais, fotos da trena ou checklist configuravel.

## W.VETRO — REFERENCIA FUNCIONAL
`FELIPE ALVES SANTANA-861.pdf`:
- orçamento `861`;
- cliente `FELIPE ALVES SANTANA`;
- nome da obra `CASA`;
- cidade `JOSE BONIFACIO / SP`;
- 7 itens;
- linha Suprema;
- esse layout nao imprime largura/altura das esquadrias.

Regra preservada: medida impressa em PDF W.Vetro continua sendo referencia do orçamento e nunca preenche automaticamente as seis medidas finais da obra sem uma fonte explicitamente marcada como Medida Final.

## W.VETRO API — OPORTUNIDADE MAPEADA, NAO IMPLEMENTADA
- Endpoints avaliados para autenticacao, linhas, produto por chave, cores, vidros, pessoas/vendedores, metas, pedidos/orcamentos, compras/NF, estoque, financeiro, lotes, producao e instalacoes.
- Futura integracao deve ser server-side; Atlas continua fonte da verdade.
- Ainda nao foi confirmado endpoint publico para receitas/BOM, formulas de corte, usinagens, lista/plano de corte ou otimizacao de barras.

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- PR #120: SIM/NAO dos quatro itens padrao, observacao por peca e modal de vista interna.
- PR #119 precisa validacao visual completa em campo.
- Confirmacao de Venda Fase 1.
- Importacao generica por PDF continua dependente de validacao por layouts reais.

## PARCIAL / DIVIDA TECNICA
- O novo bloco padrao da PR #120 esta inicialmente na tela interna da Medicao Final; acesso externo deve ser validado/estendido se o fluxo de campo usar o link externo como interface principal.
- Entidade persistente `vendas`/`obras` ainda nao existe.
- Regras condicionais completas do checklist V2 e `exigir_foto_quando` ainda pendentes.
- O orçamento de apoio W.Vetro ainda usa `orcamentos`.
- Testes automatizados de regra de negocio ainda nao existem.

## SEGURANCA / MIGRATIONS
- Acesso externo da Medicao Final e server-side, com token-hash, validade e revogacao.
- Importacao W.Vetro e identificacao server-side exigem sessao Atlas valida.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
