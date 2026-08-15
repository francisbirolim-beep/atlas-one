# CURRENT_STATE.md — Atlas One

> Regra multiagente: o repositorio e a unica fonte da verdade. Antes de alterar codigo, verificar o estado real do repositorio. Ao concluir implementacao relevante, atualizar CURRENT_STATE.md, IMPLEMENTATIONS.md e NEXT_TASK.md.

Verificado em: 2026-08-14. `main` esta no merge da PR #122 (`a398a7ac0206b7443fe0c37ef1a8e17d2cf4dcfe`). A branch atual `feat/mobile-favoritos` substitui a barra fixa inferior do celular por um acesso compacto de Favoritos.

## FUNCIONANDO / MERGEADO EM MAIN
- Login/autenticacao e controle Master/funcionario.
- Kanban de orcamentos, cadastros, Orcamento Rapido/Balcao, tipologias dinamicas e automacoes.
- PRs #105 a #108: fotos de campo, identificacao LARGURA/ALTURA, leitura por IA da trena/laser e correcao Baixo/Cima da largura.
- PRs #109 a #111: anexo W.Vetro original, leitura automatica do total, moeda BRL e envio/reenvio individual de anexos.
- PRs #112 a #118: importacao W.Vetro em Nova Medicao, suporte a PDF sem dimensoes e correcoes do parser; teste real do PDF 861 confirmou Cliente `FELIPE ALVES SANTANA`, Cidade `JOSE BONIFACIO - SP`, 7 itens.
- PR #119: toda peca da Medicao Final mostra sempre 3 larguras, 3 alturas, foto da trena de LARGURA e ALTURA; `medido=true` somente quando as seis medidas sao positivas; heranca somente de orcamento Atlas `tipo_medida=final`.
- PR #120: CONTRAMARCO, ARREMATE, CADEIRINHA, CANTONEIRA SIM/NAO, observacao por peca e lembrete da vista interna.
- PR #121: fluxo mobile por peca em ordem unica: medidas/fotos -> SIM/NAO -> observacao -> demais campos -> fotos adicionais.
- PR #122: medicao parcial, tempo ativo, historico de pausa/retomada e indicacao das pecas feitas/em aberto.
- Medicao Final V2 operacional, com status, responsavel, pendencias, checklist/fotos e link externo seguro.
- Engenharia Fases 1 a 4 concluidas.
- Build Validation no GitHub Actions (`npm install` + `npm run build`).

## EM VALIDACAO — FAVORITOS NO MOBILE
Pedido do usuario apos teste no iPhone:
- remover a barra inferior fixa com varios icones e labels cortados;
- manter um local claro para favoritos;
- permitir escolher/desmarcar atalhos favoritos;
- mostrar favoritos tambem na tela Inicio.

Implementado na branch atual:
- a navegacao antiga do `Sidebar` continua intacta no desktop, mas fica oculta no mobile;
- novo `MobileFavorites` cria um botao compacto `Favoritos` no canto inferior do celular;
- ao tocar, abre uma folha inferior com os favoritos atuais e a lista de Paginas e Setores disponiveis;
- tocar na estrela adiciona/remove favorito usando as mesmas preferencias ja existentes em `lib/guias.ts` e `lib/favoritosSetores.ts`;
- favoritos antigos da barra sao preservados, pois as mesmas chaves de localStorage continuam sendo usadas;
- na tela Inicio, aparece um bloco `Acesso rápido / Favoritos` com ate 5 atalhos e acesso para editar/abrir os demais;
- permissoes de usuario continuam respeitadas ao listar Setores;
- nenhum destino/rota foi removido.

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

## W.VETRO API — OPORTUNIDADE MAPEADA, NAO IMPLEMENTADA
- Endpoints avaliados para autenticacao, linhas, produto por chave, cores, vidros, pessoas/vendedores, metas, pedidos/orcamentos, compras/NF, estoque, financeiro, lotes, producao e instalacoes.
- Futura integracao deve ser server-side; Atlas continua fonte da verdade.
- Ainda nao foi confirmado endpoint publico para receitas/BOM, formulas de corte, usinagens, lista/plano de corte ou otimizacao de barras.

## IMPLEMENTADO MAS NAO VALIDADO FUNCIONALMENTE
- Novo fluxo de Favoritos mobile da branch atual.
- PR #122 precisa teste real de pausa/retomada em campo.
- Persistencia dos quatro SIM/NAO, observacao, fotos e medidas continua em validacao de campo.

## PARCIAL / DIVIDA TECNICA
- Favoritos ficam salvos no localStorage por dispositivo/navegador, como ja ocorria antes; sincronizacao por usuario/banco pode ser adicionada depois.
- Campos fixos e controle parcial estao inicialmente na tela interna; acesso externo precisa ser estendido se for a interface principal do medidor.
- Entidade persistente `vendas`/`obras` ainda nao existe.
- Regras condicionais completas do checklist V2 e `exigir_foto_quando` ainda pendentes.
- O orcamento de apoio W.Vetro ainda usa `orcamentos`.
- Testes automatizados de regra de negocio ainda nao existem.

## SEGURANCA / MIGRATIONS
- Acesso externo da Medicao Final e server-side, com token-hash, validade e revogacao.
- Importacao W.Vetro e identificacao server-side exigem sessao Atlas valida.
- Favoritos mobile nao exigem migration.
- Nao usar `migration repair --reverted` no banco atual sem diagnostico explicito.
