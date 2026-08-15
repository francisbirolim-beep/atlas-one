# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-14. `main` esta no merge da PR #124, com navegacao mobile Voltar/Inicio. A branch atual `fix/remover-medida-final-duplicada` elimina a Medida final genérica/legada da navegação e mantém somente a Medição Final oficial.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- PRs #105 a #108: fotos de campo, identificacao LARGURA/ALTURA, leitura por IA da trena/laser e correcao Baixo/Cima da largura.
- PRs #109 a #111: anexo W.Vetro original, leitura automatica do total, moeda BRL e envio/reenvio individual de anexos.
- PRs #112 a #118: importacao W.Vetro em Nova Medicao, suporte a PDFs sem dimensoes e correcoes do parser; teste real do PDF 861 confirmou Cliente `FELIPE ALVES SANTANA`, Cidade `JOSE BONIFACIO - SP`, 7 itens.
- PR #119: toda peca da Medicao Final mostra sempre 3 larguras, 3 alturas, foto da trena de LARGURA e ALTURA; `medido=true` somente quando as seis medidas sao positivas.
- PR #120: CONTRAMARCO, ARREMATE, CADEIRINHA, CANTONEIRA SIM/NAO, observacao por peca e lembrete da vista interna.
- PR #121: fluxo mobile por peca em ordem unica: medidas/fotos -> SIM/NAO -> observacao -> demais campos -> fotos adicionais.
- PR #122: medicao parcial, tempo ativo, historico de pausa/retomada e indicacao das pecas feitas/em aberto.
- PR #123: barra inferior mobile extensa removida visualmente; Favoritos passa a ser o acesso rapido principal no celular.
- PR #124: botoes mobile `Voltar` e `Inicio` para nao prender o usuario em telas internas.
- Medicao Final V2 oficial em `/producao/medicao-final` operacional, com status, responsavel, pendencias, checklist/fotos e link externo seguro.
- Engenharia Fases 1 a 4 concluidas.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).

## EM VALIDACAO — REMOCAO DA MEDIDA FINAL DUPLICADA
O usuario confirmou visualmente que a Medicao Final que deve permanecer e a tela oficial em `/producao/medicao-final`, com quadro `AGUARDANDO LIBERAÇÃO`, `Nova medição` e cards reais de clientes.

Implementado na branch atual:
- adiciona a Medicao Final oficial como pagina fixa de navegacao/favoritos;
- `listarSetores()` remove o setor generico legado chamado `Medida final`/`Medicao final` quando ele nao aponta para `/producao/medicao-final`;
- isso tira a duplicata de Favoritos, Setores, Sidebar e demais telas que consomem a lista global de setores;
- o Kanban generico antigo deixa de ser oferecido pela navegacao normal;
- dados antigos do setor nao sao apagados do banco nesta etapa, evitando risco de quebrar relacoes.

## ORDEM ATUAL POR PECA — MEDICAO FINAL
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

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- Remocao visual/global da Medida Final generica da branch atual.
- PR #124 precisa validacao visual continua no iPhone.
- PR #122 precisa teste real de pausa/retomada em campo.
- Persistencia dos quatro SIM/NAO, observacao, fotos e medidas continua em validacao de campo.

## PARCIAL / DIVIDA TECNICA
- O registro legado de setor `Medida final` pode continuar fisicamente no banco; foi retirado da operacao por filtro. Excluir fisicamente so deve ser feito depois de verificar dependencias.
- Favoritos ficam salvos no localStorage por dispositivo/navegador; sincronizacao por usuario/banco pode ser adicionada depois.
- Campos fixos e controle parcial estao inicialmente na tela interna; acesso externo precisa ser estendido se for a interface principal do medidor.
- Entidade persistente `vendas`/`obras` ainda nao existe.
- Testes automatizados de regra de negocio ainda nao existem.

## SEGURANCA / MIGRATIONS
- Acesso externo da Medicao Final e server-side, com token-hash, validade e revogacao.
- Importacao W.Vetro e identificacao server-side exigem sessao Atlas valida.
- Esta remocao de duplicata nao exige migration.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
