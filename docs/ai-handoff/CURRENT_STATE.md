# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-14. `main` esta no merge da PR #121 (`be277ffe5636a18ca7973c04c60d7abba2eb50a5`). A branch atual `feat/medicao-parcial-historico-tempo` adiciona controle de tempo ativo, medicao parcial, historico de pausas/retomadas e identificacao visual das pecas feitas/em aberto.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- PRs #105 a #108: fotos de campo, identificacao LARGURA/ALTURA, leitura por IA da trena/laser e correcao Baixo/Cima da largura.
- PRs #109 a #111: anexo W.Vetro original, leitura automatica do total, moeda BRL e envio/reenvio individual de anexos.
- PRs #112 a #118: importacao W.Vetro em Nova Medicao, suporte a PDF sem dimensoes e correcoes do parser; teste real do PDF 861 confirmou Cliente `FELIPE ALVES SANTANA`, Cidade `JOSE BONIFACIO - SP`, 7 itens.
- PR #119: toda peca da Medicao Final mostra sempre 3 larguras, 3 alturas, foto da trena de LARGURA e ALTURA; `medido=true` somente quando as seis medidas sao positivas; heranca somente de orcamento Atlas `tipo_medida=final`.
- PR #120: toda peca ganhou CONTRAMARCO, ARREMATE, CADEIRINHA e CANTONEIRA com SIM/NAO, observacao por peca e lembrete para medir pela vista interna do vao.
- PR #121: reorganiza o fluxo da peca no celular: medidas/fotos -> SIM/NAO -> observacao -> demais campos -> fotos adicionais, removendo o painel duplicado.
- Medicao Final V2 operacional, com status, responsavel, pendencias, checklist/fotos e link externo seguro.
- Engenharia Fases 1 a 4 concluidas.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).

## EM VALIDACAO — MEDICAO PARCIAL / TEMPO / HISTORICO
Pedido do usuario:
- depois de iniciar, registrar data e contar o tempo gasto na medicao;
- permitir salvar uma visita como Medicao Parcial quando nem todos os vaos puderem ser medidos;
- preservar tudo que ja foi feito;
- mostrar claramente cada peca como feita ou em aberto;
- permitir voltar depois, retomar e medir apenas o restante;
- manter historico das pausas e retomadas.

Implementado na branch atual sem nova migration:
- novo `MedicaoParcialPanel` aparece depois que a medicao possui `iniciado_em`;
- cronometro mostra somente tempo ativo; ao salvar parcial, o tempo pausa; ao retomar, volta a contar;
- resumo visual mostra `✅ feita` e `em aberto` por peca;
- botao `Salvar medição parcial` preserva medidas, fotos, checklist e demais dados ja gravados;
- botao `Retomar medição` continua a mesma Medicao Final sem recriar itens;
- historico usa a tabela ja existente `medicao_revisoes`, registrando snapshots `Medição parcial` e `Retomada da medição` com data, usuario e quantidade feita/em aberto;
- o inicio original continua vindo de `medicoes_finais.iniciado_em`;
- nao foi criado novo status em `status_operacional` nesta etapa para evitar incompatibilidade com telas antigas; o estado parcial e derivado do ultimo evento do historico.

## ORDEM ATUAL POR PECA
1. identificacao da peca;
2. foto da trena LARGURA / ALTURA;
3. Largura Baixo / Meio / Cima;
4. Altura Direita / Meio / Esquerda;
5. Contramarco / Arremate / Cadeirinha / Cantoneira — SIM/NAO;
6. observacao;
7. demais campos configuraveis;
8. fotos adicionais.

## W.VETRO — REFERENCIA FUNCIONAL
`FELIPE ALVES SANTANA-861.pdf`: orcamento 861, cliente FELIPE ALVES SANTANA, obra CASA, JOSE BONIFACIO/SP, 7 itens. Esse layout nao imprime largura/altura das esquadrias.

Regra preservada: medida impressa em PDF W.Vetro continua sendo referencia do orcamento e nunca preenche automaticamente as seis medidas finais da obra sem uma fonte explicitamente marcada como Medida Final.

## W.VETRO API — OPORTUNIDADE MAPEADA, NAO IMPLEMENTADA
- Endpoints avaliados para autenticacao, linhas, produto por chave, cores, vidros, pessoas/vendedores, metas, pedidos/orcamentos, compras/NF, estoque, financeiro, lotes, producao e instalacoes.
- Futura integracao deve ser server-side; Atlas continua fonte da verdade.
- Ainda nao foi confirmado endpoint publico para receitas/BOM, formulas de corte, usinagens, lista/plano de corte ou otimizacao de barras.

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- Medicao parcial, tempo ativo e historico da branch atual.
- PR #121 precisa validacao visual final em celular.
- Persistencia real dos quatro SIM/NAO e observacao precisa continuar sendo testada em campo.
- PR #119 precisa validacao completa das fotos da trena e heranca de `tipo_medida=final`.
- Confirmacao de Venda Fase 1.

## PARCIAL / DIVIDA TECNICA
- Estado parcial ainda e derivado do historico em `medicao_revisoes`; uma futura versao pode ganhar status/entidade de sessoes dedicado se necessario.
- Campos fixos e controle parcial estao inicialmente na tela interna; acesso externo precisa ser estendido se for a interface principal do medidor.
- Entidade persistente `vendas`/`obras` ainda nao existe.
- Regras condicionais completas do checklist V2 e `exigir_foto_quando` ainda pendentes.
- O orcamento de apoio W.Vetro ainda usa `orcamentos`.
- Testes automatizados de regra de negocio ainda nao existem.

## SEGURANCA / MIGRATIONS
- Acesso externo da Medicao Final e server-side, com token-hash, validade e revogacao.
- Importacao W.Vetro e identificacao server-side exigem sessao Atlas valida.
- Esta etapa de medicao parcial reutiliza `medicao_revisoes`; nao depende de migration nova.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
