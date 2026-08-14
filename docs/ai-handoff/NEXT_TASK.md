# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a branch `fix/medicao-wvetro-sem-medidas`, criada após teste real da PR #112 com `FELIPE ALVES SANTANA-861.pdf`.

O PDF foi reconhecido como W.Vetro, mas o documento não imprime largura/altura das esquadrias. A versão anterior bloqueava a importação por exigir dimensões. A correção passa a aceitar itens identificáveis mesmo sem tamanho, sem inventar medidas.

## VALIDAR ANTES DE ENCERRAR ESTA CORRECAO
Usar `FELIPE ALVES SANTANA-861.pdf`.

1. Abrir `Medida Final` / `/producao/medicao-final`.
2. Clicar em `Nova medição`.
3. Selecionar `FELIPE ALVES SANTANA-861.pdf`.
4. Confirmar que NÃO aparece mais o erro `nenhuma esquadria com largura e altura pôde ser lida`.
5. Confirmar a prévia ANTES de gravar:
   - orçamento `861`;
   - cliente `FELIPE ALVES SANTANA`;
   - cidade `JOSE BONIFACIO - SP`;
   - `7 item(ns)`;
   - cada item sem dimensão deve mostrar `Sem medida no PDF`, nunca `0 x 0` como informação ao usuário.
6. Conferir os 7 itens esperados:
   - WC SUITE — maxim-ar com peitoril fixo — Suprema;
   - WC — maxim-ar com peitoril fixo — Suprema;
   - WC — maxim-ar 1 módulo — Suprema;
   - QUARTO — porta de giro 1 folha — Suprema;
   - SUITE — porta de correr 3 folhas — Suprema;
   - QUARTO — janela de correr integrada 2 folhas — Suprema;
   - QUARTO — janela de correr 2 folhas móveis — Suprema.
7. Conferir cor/vidro quando reconhecidos pelo texto do PDF.
8. Clicar em `Confirmar e criar Medição Final`.
9. Confirmar que foram criados 7 itens.
10. Abrir os itens e confirmar que aparece `REFERÊNCIA ORÇAMENTO: medidas não informadas no PDF`.
11. Confirmar regra crítica: `Largura Baixo/Meio/Cima` e `Altura Direita/Meio/Esquerda` continuam vazias.
12. Confirmar que o PDF original permanece anexado ao orçamento de apoio.
13. Reimportar o orçamento `861` e confirmar bloqueio de duplicidade.
14. Fazer um teste de regressão com um PDF W.Vetro que tenha dimensões (ex.: `FRANCIS TESTE-977.pdf`) e confirmar que as dimensões continuam aparecendo apenas como referência.
15. Confirmar Build Validation verde no head final antes do merge.

## DEPOIS DESTA CORRECAO
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
7. Confirmar com W.Vetro se a API expoe tipologias, perfis, acessorios, receitas/BOM, formulas, usinagens, lista/plano de corte e otimizacao.

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
- Kanban #104 a #111: fluxo de orçamento, fotos, leitura da trena, anexo W.Vetro, total automático, moeda BRL e reenvio de anexos.
- PR #112: importação de orçamento W.Vetro diretamente em `Nova medição`, com preview, preservação do PDF e criação da Medição Final.

## CUIDADOS
- GitHub e a única fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> build válido -> merge.
- PDF W.Vetro original deve ser preservado.
- Falta de largura/altura no PDF NÃO é motivo para descartar uma esquadria identificável.
- Nunca inventar dimensão ausente.
- Medida do orçamento W.Vetro NUNCA deve preencher automaticamente as seis medidas finais da obra.
- Importação W.Vetro deve passar por pré-visualização/revisão antes da gravação.
- Parser PDF continua sendo fallback; API estruturada deve ser preferida quando estiver disponível e validada.
- Credenciais W.Vetro nunca devem ficar no browser.
- Leitura por IA da trena é sugestão; o colaborador deve conferir antes de salvar.
- Não automatizar lista de corte antes de fechar o modelo de receitas e versões.
