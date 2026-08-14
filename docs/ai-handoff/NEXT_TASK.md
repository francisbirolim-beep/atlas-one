# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a branch `fix/ocultar-apoio-wvetro-seletor-atlas`, criada depois de um novo teste real da tela `Nova medição`.

A PR #116 ja esta em `main` e permite reaproveitar um orçamento de apoio W.Vetro antigo sem Medicao Final. Mesmo assim, ao apenas abrir `Nova medição`, o bloco `OU USAR ORÇAMENTO DO ATLAS` continua mostrando o card antigo `CELULARTEL. FIXO:` / `396 JOSE BONIFACIO - SP`.

A causa e independente do parser: `listarOrcamentosSemMedicao()` lista todo orçamento vendido sem Medicao Final, inclusive registros internos de apoio criados pelo importador W.Vetro.

A branch atual filtra do seletor qualquer orçamento cujo `descricao_livre` comece por `Importado do W.Vetro |`. O registro continua preservado no banco e continua disponivel para o fluxo de importacao/reparo W.Vetro.

## VALIDAR ANTES DO MERGE
1. Abrir `Medida Final`.
2. Clicar em `Nova medição` sem selecionar PDF.
3. Confirmar que o card `CELULARTEL. FIXO:` / `396 JOSE BONIFACIO - SP` nao aparece mais em `OU USAR ORÇAMENTO DO ATLAS`.
4. Confirmar que orcamentos reais criados/vendidos no Atlas e ainda sem Medicao Final continuam aparecendo normalmente nesse bloco.
5. Selecionar `FELIPE ALVES SANTANA-861.pdf` no bloco W.Vetro.
6. Confirmar no preview:
   - Cliente `FELIPE ALVES SANTANA`;
   - Cidade `JOSE BONIFACIO - SP`;
   - 7 itens.
7. Confirmar que a importacao/reaproveitamento do apoio antigo continua funcionando e nao foi afetada pelo filtro visual.
8. Confirmar Build Validation verde no head final antes do merge.

## DEPOIS DESTA CORRECAO
1. Continuar o teste de campo da Medicao Final 861.
2. Validar faixa Cliente/Obra/Orçamento e telefone automatico do responsavel.
3. Confirmar que `Cadastro > Dados da Empresa` fica vazio ate o usuario salvar configuracao manual.
4. Fazer regressao com `FRANCIS TESTE-977.pdf`, que possui dimensoes de referencia.
5. Criar a area `Configurações -> Orçamento` para dados da empresa, validade, pagamento, prazo, garantia, observacoes e rodape.
6. Fazer todos os PDFs Atlas consumirem somente configuracoes salvas pelo usuario.
7. Melhorar o layout profissional do PDF Atlas.
8. Iniciar o conector W.Vetro API em modo SOMENTE LEITURA quando houver credencial/ambiente de teste e exemplos reais de responses.

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
- PR #115: correcao de Cliente e Cidade no preview do PDF 861.
- PR #116: reaproveitamento/reparo de orçamento de apoio W.Vetro antigo sem Medicao Final.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> build valido -> merge.
- PDF W.Vetro original deve ser preservado.
- Falta de largura/altura no PDF nao e motivo para descartar uma esquadria identificavel.
- Nunca inventar dimensao ausente.
- Medida do orçamento W.Vetro nunca deve preencher automaticamente as seis medidas finais da obra.
- Duplicidade W.Vetro so deve bloquear quando ja existir Medicao Final vinculada ao mesmo orçamento externo.
- Orçamentos de apoio W.Vetro nao pertencem ao seletor `OU USAR ORÇAMENTO DO ATLAS`; ocultar da lista nao significa apagar do banco.
- Credenciais W.Vetro nunca devem ficar no browser.
- Nao automatizar lista de corte antes de fechar o modelo de receitas e versoes.
