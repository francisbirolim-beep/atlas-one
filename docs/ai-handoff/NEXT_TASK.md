# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a PR #119 / branch `feat/medicao-final-medidas-fixas`.

O teste real do PDF `FELIPE ALVES SANTANA-861.pdf` confirmou que a PR #118 corrigiu o cabecalho: Cliente `FELIPE ALVES SANTANA`, Cidade `JOSE BONIFACIO - SP`, 7 itens.

O usuario pediu agora que toda peça da Medicao Final tenha um bloco fixo, independente das configuracoes de checklist, contendo:
- 3 larguras: baixo, meio, cima;
- 3 alturas: direita, meio, esquerda;
- foto da trena da largura;
- foto da trena da altura.

Tambem foi definido que, quando a Medicao Final vier de um orçamento Atlas realmente marcado como `tipo_medida=final`, as medidas finais e fotos ja registradas no orçamento devem ser reaproveitadas automaticamente. Orçamento comum/referencia nunca deve preencher esses seis campos.

## IMPLEMENTADO NA PR #119
1. `MedicaoChecklistV2Panel` ganhou secao fixa `Medidas finais da peça` antes do checklist configuravel.
2. Fotos LARGURA/ALTURA possuem area propria, preview e troca.
3. As seis medidas salvam diretamente em `medicao_itens`.
4. A peça fica `medido=true` somente quando as seis medidas sao positivas.
5. O seletor de peças exibe `Medidas completas` / `Medidas pendentes`.
6. `herdarMedidasFinaisDoOrcamento()` reaproveita dados de orçamento `tipo_medida=final` sem inventar nem sobrescrever valores.
7. A heranca e conservadora e so pareia automaticamente quando a quantidade de linhas da Medicao Final corresponde aos itens do orçamento.
8. PDF W.Vetro e orçamento `tipo_medida=comum` continuam sem preencher as seis medidas finais automaticamente.

## VALIDAR ANTES DO MERGE
1. Confirmar Build Validation verde no head final.
2. Abrir uma Medicao Final criada pelo PDF `FELIPE ALVES SANTANA-861.pdf`.
3. Confirmar que cada uma das 7 peças mostra sempre:
   - foto LARGURA;
   - foto ALTURA;
   - Largura Baixo / Meio / Cima;
   - Altura Direita / Meio / Esquerda.
4. Confirmar que, no PDF 861, os seis campos iniciam vazios porque o documento nao fornece Medida Final.
5. Digitar as seis medidas em uma peça e salvar.
6. Reabrir/recarregar e confirmar persistencia dos seis valores.
7. Confirmar que a peça muda para `Medidas completas` e passa a contar no progresso somente quando as seis medidas estiverem preenchidas.
8. Apagar/deixar vazia uma das seis medidas, salvar e confirmar retorno para pendente.
9. Tirar/subir foto da trena de largura e altura; confirmar preview e persistencia depois de recarregar.
10. Testar troca das duas fotos.
11. Criar/usar um orçamento Atlas com `tipo_medida=final` e medidas/fotos ja registradas; criar a Medicao Final e confirmar que o bloco abre ja preenchido com exatamente esses dados.
12. Confirmar que um orçamento Atlas `tipo_medida=comum` nao herda medidas finais.
13. Fazer regressao com `FRANCIS TESTE-977.pdf` e confirmar que dimensoes de referencia do PDF nao preenchem as seis medidas finais.

## DEPOIS DESTA VALIDACAO
1. Continuar teste de campo completo da Medicao Final 861.
2. Avaliar se a foto da trena dentro da Medicao Final tambem deve disparar automaticamente a leitura por IA, como ja acontece no Kanban.
3. Validar faixa Cliente/Obra/Orçamento e telefone automatico do responsavel.
4. Confirmar que `Cadastro > Dados da Empresa` fica vazio ate o usuario salvar configuracao manual.
5. Criar `Configurações -> Orçamento` para validade, pagamento, prazo, garantia, observacoes, rodape e demais dados do PDF Atlas.
6. Melhorar layout profissional do PDF Atlas.
7. Iniciar conector W.Vetro API em modo SOMENTE LEITURA quando houver credencial/ambiente de teste e responses reais.

## PRIORIDADES DA FUTURA API W.VETRO
- `Produtos/linhas`;
- `Produtos/produtoByKey`;
- `Produtos/cores`;
- `Produtos/vidros`;
- `vendas/orcamentos`;
- `vendas/pedidoByKey`;
- compras/NF e itens;
- estoque;
- producao/lotes/producaoProjeto/instalacoes.

Preservar IDs/codigos W.Vetro e JSON bruto em futura camada de integracao; Atlas continua sendo fonte da verdade. Confirmar com W.Vetro se a API expoe tipologias, perfis, acessorios, receitas/BOM, formulas, usinagens, lista/plano de corte e otimizacao.

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
- Kanban #104 a #111.
- PR #112: importacao de orçamento W.Vetro diretamente em `Nova medição`.
- PR #113: importacao de W.Vetro sem largura/altura, sem inventar dimensoes.
- PR #114: identificacao Cliente/Obra/Orçamento, telefone do responsavel e dados da empresa somente manuais.
- PR #115: primeira correcao de Cliente/Cidade no preview do PDF 861.
- PR #116: reaproveitamento/reparo de apoio W.Vetro antigo sem Medicao Final.
- PR #117: ocultacao dos apoios W.Vetro do seletor de orcamentos Atlas.
- PR #118: rejeicao de rotulos concatenados no Cliente; preview 861 validado corretamente.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> build valido -> merge.
- PDF W.Vetro original deve ser preservado.
- Nunca inventar dimensao ausente.
- Medida comum/referencia de orçamento W.Vetro nunca preenche automaticamente as seis medidas finais.
- Heranca automatica das seis medidas so ocorre para orçamento Atlas explicitamente `tipo_medida=final`.
- Nao sobrescrever medida/foto ja salva na Medicao Final com dado herdado do orçamento.
- Duplicidade W.Vetro so deve bloquear quando ja existir Medicao Final vinculada ao mesmo orçamento externo.
- Orçamentos de apoio W.Vetro nao pertencem ao seletor `OU USAR ORÇAMENTO DO ATLAS`.
- Rotulos de cabecalho concatenados nunca devem ser aceitos como nome de cliente.
- Credenciais W.Vetro nunca devem ficar no browser.
- Nao automatizar lista de corte antes de fechar o modelo de receitas e versoes.
