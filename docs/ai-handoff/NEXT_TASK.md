# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a branch `fix/wvetro-orcamento-apoio-antigo` criada depois de um novo teste real da tela `Nova medição`.

A PR #115 ja esta em `main` e corrige o parser do preview W.Vetro. O novo print mostrou, no bloco `OU USAR ORÇAMENTO DO ATLAS`, um registro antigo com Cliente `CELULARTEL. FIXO:` e Cidade `396 JOSE BONIFACIO - SP`.

Esse registro e compatível com um orçamento de apoio criado por uma importacao antiga do W.Vetro que ficou sem Medicao Final. A rota anterior tratava qualquer orçamento de apoio com o mesmo numero como duplicidade, mesmo quando nao existia medicao vinculada.

## VALIDAR ANTES DO MERGE
Usar `FELIPE ALVES SANTANA-861.pdf`.

1. Abrir `Medida Final` e `Nova medição`.
2. O card antigo incorreto pode ainda aparecer em `OU USAR ORÇAMENTO DO ATLAS` antes da nova importacao, pois ele ja existe no banco.
3. Selecionar novamente o PDF 861 em `Importar orçamento W.Vetro`.
4. Confirmar no preview:
   - Cliente `FELIPE ALVES SANTANA`;
   - Cidade `JOSE BONIFACIO - SP`;
   - 7 itens.
5. Clicar em `Confirmar e criar Medição Final`.
6. Confirmar que a importacao NAO e bloqueada apenas porque o orçamento de apoio antigo existe sem medicao.
7. Confirmar que a Medicao Final e criada com 7 itens.
8. Reabrir o quadro `Medida Final` e confirmar que o card antigo incorreto deixou de aparecer como orçamento sem medicao.
9. Abrir a medicao criada e conferir:
   - Cliente `FELIPE ALVES SANTANA`;
   - Nome da obra `CASA`;
   - Orçamento `Nº 861`;
   - as seis medidas finais continuam vazias.
10. Tentar importar o PDF 861 novamente com a Medicao Final ja existente e confirmar que agora sim o Atlas bloqueia duplicidade e direciona para a medicao existente.
11. Confirmar Build Validation verde no head final antes do merge.

## DEPOIS DESTA CORRECAO
1. Continuar o teste de campo da Medicao Final 861.
2. Validar preenchimento automatico do telefone do responsavel cadastrado e fallback manual.
3. Confirmar que `Cadastro > Dados da Empresa` fica vazio ate o usuario salvar configuracao manual.
4. Fazer regressao com `FRANCIS TESTE-977.pdf`, que possui dimensoes de referencia.
5. Avaliar se os orcamentos de apoio internos do W.Vetro devem ser ocultados permanentemente do bloco `OU USAR ORÇAMENTO DO ATLAS` mesmo quando estiverem sem medicao.
6. Criar a area `Configurações -> Orçamento` para dados da empresa, validade, pagamento, prazo, garantia, observacoes e rodape.
7. Fazer todos os PDFs Atlas consumirem somente configuracoes salvas pelo usuario.
8. Melhorar o layout profissional do PDF Atlas.
9. Iniciar o conector W.Vetro API em modo SOMENTE LEITURA quando houver credencial/ambiente de teste e exemplos reais de responses.

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

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> build valido -> merge.
- PDF W.Vetro original deve ser preservado.
- Falta de largura/altura no PDF nao e motivo para descartar uma esquadria identificavel.
- Nunca inventar dimensao ausente.
- Medida do orçamento W.Vetro nunca deve preencher automaticamente as seis medidas finais da obra.
- Duplicidade W.Vetro so deve bloquear quando ja existir Medicao Final vinculada ao mesmo orçamento externo.
- Um orçamento de apoio antigo sem medicao deve ser reparado/reaproveitado, nao duplicado nem bloqueado.
- Credenciais W.Vetro nunca devem ficar no browser.
- Nao automatizar lista de corte antes de fechar o modelo de receitas e versoes.
