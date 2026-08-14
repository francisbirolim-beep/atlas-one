# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a branch `fix/wvetro-cliente-rotulo-concatenado`, criada depois do teste real do preview do PDF `FELIPE ALVES SANTANA-861.pdf`.

A PR #117 ja esta em `main` e resolveu a exibicao do registro interno `CELULARTEL. FIXO:` no bloco `OU USAR ORÇAMENTO DO ATLAS` antes de selecionar um PDF.

Depois disso, o usuario confirmou que ao selecionar o PDF 861 o preview ainda mostrou:
- Cliente `CELULARTEL. FIXO:`;
- Cidade `JOSE BONIFACIO - SP`;
- 7 itens.

O arquivo real confirma que o cliente correto e `FELIPE ALVES SANTANA`. O cabecalho contem `Cep Numero: 861`, depois `FELIPE ALVES SANTANA (11)94641-2756` e os rotulos `CLIENTE: TEL. FIXO: CELULAR`.

Causa: o `pdf-parse` pode concatenar rotulos como `CELULARTEL. FIXO:`. A validacao anterior dependia de limite de palavra e podia aceitar essa linha falsa como nome. A branch atual rejeita linhas que tenham dois ou mais rotulos conhecidos concatenados, sem bloquear nomes reais apenas por comecarem com `TEL`.

## VALIDAR ANTES DO MERGE
1. Confirmar Build Validation verde no head final.
2. Usar `FELIPE ALVES SANTANA-861.pdf`.
3. Abrir `Medida Final` -> `Nova medição`.
4. Antes de selecionar PDF, confirmar que `CELULARTEL. FIXO:` nao aparece em `OU USAR ORÇAMENTO DO ATLAS`.
5. Selecionar o PDF 861.
6. Confirmar no preview:
   - Cliente `FELIPE ALVES SANTANA`;
   - Cidade `JOSE BONIFACIO - SP`;
   - `7 item(ns)`;
   - nenhuma linha de rotulo `CELULAR`, `TEL. FIXO`, `CLIENTE`, etc. usada como nome.
7. Conferir que os 7 itens continuam iguais ao teste anterior.
8. Confirmar que a ausencia de largura/altura continua aparecendo como ausencia de medida, sem inventar dimensoes.
9. Confirmar e criar a Medicao Final.
10. Abrir a medicao criada e conferir Cliente/Obra/Orçamento.
11. Fazer regressao com `FRANCIS TESTE-977.pdf`.

## DEPOIS DESTA CORRECAO
1. Continuar o teste de campo da Medicao Final 861.
2. Validar faixa Cliente/Obra/Orçamento e telefone automatico do responsavel.
3. Confirmar que `Cadastro > Dados da Empresa` fica vazio ate o usuario salvar configuracao manual.
4. Criar a area `Configurações -> Orçamento` para dados da empresa, validade, pagamento, prazo, garantia, observacoes e rodape.
5. Fazer todos os PDFs Atlas consumirem somente configuracoes salvas pelo usuario.
6. Melhorar o layout profissional do PDF Atlas.
7. Iniciar o conector W.Vetro API em modo SOMENTE LEITURA quando houver credencial/ambiente de teste e exemplos reais de responses.

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
- PR #115: primeira correcao de Cliente e Cidade no preview do PDF 861.
- PR #116: reaproveitamento/reparo de orçamento de apoio W.Vetro antigo sem Medicao Final.
- PR #117: ocultacao dos apoios W.Vetro do seletor de orcamentos Atlas.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> build valido -> merge.
- PDF W.Vetro original deve ser preservado.
- Falta de largura/altura no PDF nao e motivo para descartar uma esquadria identificavel.
- Nunca inventar dimensao ausente.
- Medida do orçamento W.Vetro nunca deve preencher automaticamente as seis medidas finais da obra.
- Duplicidade W.Vetro so deve bloquear quando ja existir Medicao Final vinculada ao mesmo orçamento externo.
- Orçamentos de apoio W.Vetro nao pertencem ao seletor `OU USAR ORÇAMENTO DO ATLAS`.
- Rotulos de cabecalho concatenados nunca devem ser aceitos como nome de cliente.
- Credenciais W.Vetro nunca devem ficar no browser.
- Nao automatizar lista de corte antes de fechar o modelo de receitas e versoes.
