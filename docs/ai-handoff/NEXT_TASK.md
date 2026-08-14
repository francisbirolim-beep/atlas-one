# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a PR #112 (`feat/medicao-final-importar-wvetro`), que permite criar uma Medicao Final diretamente pelo PDF de um orçamento W.Vetro no botao `Nova medição`.

A implementacao preserva o fluxo ja existente de selecionar um orçamento vendido do Atlas e adiciona, acima dele, a opcao `Importar orçamento W.Vetro` com leitura -> revisao -> confirmacao.

## VALIDAR ANTES DE ENCERRAR A PR #112
Usar preferencialmente o PDF real `FRANCIS TESTE-977.pdf`.

1. Abrir `Medida Final` / `/producao/medicao-final`.
2. Clicar em `Nova medição`.
3. Confirmar que aparece o bloco `Importar orçamento W.Vetro` e, abaixo, continua existindo a busca de orcamentos vendidos do Atlas.
4. Selecionar `FRANCIS TESTE-977.pdf`.
5. Confirmar que a pre-visualizacao e exibida ANTES de gravar qualquer Medicao Final.
6. No PDF de referencia, conferir os dados esperados quando o texto permitir:
   - numero W.Vetro: `977`;
   - cliente: `FRANCIS TESTE`;
   - cidade: `JOSE BONIFACIO` / SP;
   - total: `R$ 2.716,84`;
   - pelo menos 1 item;
   - porta de correr 3 folhas moveis / Suprema;
   - quantidade 1;
   - referencia de tamanho `1789 x 1962 mm`;
   - perfil/cor `BRANCO` e vidro `INCOLOR 06MM - TEMPERADO` quando reconhecidos.
7. Confirmar que ambiente vazio no PDF aparece como `Ambiente não informado`, sem bloquear a importacao.
8. Alterar cliente/cidade na pre-visualizacao apenas para testar que os campos sao editaveis; depois restaurar os valores corretos antes de confirmar.
9. Clicar em `Confirmar e criar Medição Final`.
10. Confirmar que o Atlas abre a nova Medicao Final e cria os itens reconhecidos.
11. Abrir o item e confirmar a regra critica: `1789 x 1962` aparece somente como referencia do orçamento; `Largura Baixo/Meio/Cima` e `Altura Direita/Meio/Esquerda` devem continuar vazias.
12. Confirmar que o PDF W.Vetro original foi preservado no orçamento de apoio do Atlas.
13. Tentar importar novamente o orçamento `977`: o sistema deve impedir duplicacao e, quando houver Medicao Final vinculada, abrir a existente.
14. Fazer um teste rapido pelo fluxo antigo: `Nova medição` -> selecionar um orçamento vendido do Atlas e confirmar que continua funcionando.
15. Confirmar que Build Validation do head final da PR esta verde antes do merge.

## DEPOIS DA PR #112
1. Criar `Configurações -> Orçamento` usando `configuracoes_gerais` para dados da empresa, validade, pagamento, prazo, garantia, observacoes e rodape.
2. Fazer o PDF atual do Atlas consumir essas configuracoes.
3. Melhorar o layout profissional do PDF Atlas.
4. Iniciar o conector W.Vetro API em modo SOMENTE LEITURA quando houver credencial/ambiente de teste e exemplos reais de responses.
5. Para a API W.Vetro, priorizar:
   - `Produtos/linhas`;
   - `Produtos/produtoByKey`;
   - `Produtos/cores`;
   - `Produtos/vidros`;
   - `vendas/orcamentos`;
   - `vendas/pedidoByKey`;
   - compras/NF e itens;
   - estoque;
   - producao/lotes/producaoProjeto/instalacoes.
6. Preservar IDs/codigos W.Vetro e JSON bruto em futura camada de integracao; Atlas continua sendo fonte da verdade.
7. Perguntar/confirmar com W.Vetro se a API expoe tipologias, perfis, acessorios, receitas/BOM, formulas, usinagens, lista/plano de corte e otimizacao; nao assumir que esses dados estao acessiveis.

## DEPOIS DO ORCAMENTO / INTEGRACAO
- Engenharia Fase 5: base de receitas tecnicas por tipologia;
- implementar calculos/MEE por tipologia;
- gerar lista de materiais e lista de corte;
- otimizar barras;
- integrar liberacao tecnica calculada com Producao/Estoque.

## JA NA MAIN
- Medicao Final V2 PRs #54 a #56.
- Redesign profissional PRs #57 a #63.
- Engenharia Fases 1 a 4: PRs #64, #66, #69 e #73.
- Kanban #104: primeira coluna exige `Iniciar orçamento` e preserva fotos.
- Kanban #105: galeria de fotos coletadas em campo.
- Kanban #106: fotos de largura e altura separadas e identificadas.
- Kanban #107: leitura automatica por IA das fotos da trena.
- Kanban #108: correcao da inversao Baixo/Cima na LARGURA.
- Kanban #109: anexo W.Vetro com titulo automatico e botao liberado.
- Kanban #110: total do PDF W.Vetro lido automaticamente.
- Kanban #111: moeda BRL e envio/reenvio individual de anexos.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> build valido -> merge.
- PDF W.Vetro original deve ser preservado.
- Medida do orçamento W.Vetro NUNCA deve preencher automaticamente as seis medidas finais da obra.
- Importacao W.Vetro deve passar por pre-visualizacao/revisao antes da gravacao.
- Ambiente vazio no orçamento nao pode eliminar uma esquadria valida; sinalizar falta e permitir conferencia em campo.
- Parser PDF continua sendo fallback e pode variar entre layouts; API estruturada deve ser preferida quando estiver disponivel e validada.
- Credenciais W.Vetro nunca devem ficar no browser.
- Leitura por IA da trena e sugestao; o colaborador deve conferir antes de salvar.
- Nao automatizar lista de corte antes de fechar o modelo de receitas e versoes.
