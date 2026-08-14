# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-14. `main` esta no merge da PR #120 (`6835a99b97ce8d890980540aaa75dd0b8f846e85`). A branch atual `fix/medicao-ordem-padroes-abaixo-medidas` reposiciona as conferencias fixas da Medicao Final para dentro do fluxo da mesma peca, imediatamente depois das medidas principais.

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
- PR #120: toda peça ganhou CONTRAMARCO, ARREMATE, CADEIRINHA e CANTONEIRA com SIM/NAO, observacao por peca e lembrete para medir pela vista interna do vao.
- Medicao Final V2 operacional, com status, responsavel, pendencias, checklist/fotos e link externo seguro.
- Engenharia Fases 1 a 4 concluidas.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).

## EM VALIDACAO — ORDEM DO FLUXO DA PECA
Pedido do usuario apos teste em celular:
- o bloco CONTRAMARCO / ARREMATE / CADEIRINHA / CANTONEIRA nao deve ficar como um painel separado depois das fotos;
- ele deve aparecer imediatamente abaixo das 3 larguras + 3 alturas e fotos da trena da peca selecionada;
- a observacao da peca deve continuar logo abaixo desse bloco;
- depois disso entram os demais campos configuraveis e fotos adicionais que forem sendo criados.

Implementado na branch atual:
- `MedicaoPadroesFixosPanel` agora recebe somente `itemId` e trabalha diretamente com a peca selecionada no `MedicaoChecklistV2Panel`;
- remove a segunda barra duplicada de selecao `Peca 1 / Peca 2 / ...`;
- o bloco e renderizado imediatamente depois de `Medidas finais da peça`;
- a observacao permanece logo abaixo das quatro conferencias;
- o checklist configuravel e as fotos gerais continuam depois desse bloco;
- o painel separado foi removido do `AppShell`;
- o lembrete modal da vista interna foi isolado em `MedicaoVistaInternaAviso`, portanto continua aparecendo quando a medicao esta liberada e ainda nao iniciada.

Ordem esperada por peca:
1. identificacao da peca;
2. fotos da trena LARGURA / ALTURA;
3. 3 larguras + 3 alturas;
4. CONTRAMARCO / ARREMATE / CADEIRINHA / CANTONEIRA;
5. OBSERVACAO;
6. demais campos configuraveis;
7. fotos adicionais da peca.

## W.VETRO — REFERENCIA FUNCIONAL
`FELIPE ALVES SANTANA-861.pdf`: orçamento 861, cliente FELIPE ALVES SANTANA, obra CASA, JOSE BONIFACIO/SP, 7 itens. Esse layout nao imprime largura/altura das esquadrias.

Regra preservada: medida impressa em PDF W.Vetro continua sendo referencia do orçamento e nunca preenche automaticamente as seis medidas finais da obra sem uma fonte explicitamente marcada como Medida Final.

## W.VETRO API — OPORTUNIDADE MAPEADA, NAO IMPLEMENTADA
- Endpoints avaliados para autenticacao, linhas, produto por chave, cores, vidros, pessoas/vendedores, metas, pedidos/orcamentos, compras/NF, estoque, financeiro, lotes, producao e instalacoes.
- Futura integracao deve ser server-side; Atlas continua fonte da verdade.
- Ainda nao foi confirmado endpoint publico para receitas/BOM, formulas de corte, usinagens, lista/plano de corte ou otimizacao de barras.

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- Nova ordem do fluxo por peca descrita acima.
- PR #120: persistencia real dos quatro SIM/NAO e observacao ainda precisa de teste completo em campo.
- PR #119 precisa validacao visual completa em campo.
- Confirmacao de Venda Fase 1.

## PARCIAL / DIVIDA TECNICA
- Campos fixos da PR #120 estao inicialmente na tela interna; acesso externo deve ser validado/estendido se usado como interface principal do medidor.
- Entidade persistente `vendas`/`obras` ainda nao existe.
- Regras condicionais completas do checklist V2 e `exigir_foto_quando` ainda pendentes.
- O orçamento de apoio W.Vetro ainda usa `orcamentos`.
- Testes automatizados de regra de negocio ainda nao existem.

## SEGURANCA / MIGRATIONS
- Acesso externo da Medicao Final e server-side, com token-hash, validade e revogacao.
- Importacao W.Vetro e identificacao server-side exigem sessao Atlas valida.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
