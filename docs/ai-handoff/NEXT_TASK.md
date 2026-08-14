# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a branch `fix/wvetro-cliente-cidade-preview`, criada depois do teste real do preview de importacao W.Vetro em producao.

A PR #114 ja esta em `main`. O fluxo reconhece os 7 itens de `FELIPE ALVES SANTANA-861.pdf`, mas o preview exibiu Cliente `CELULARTEL. FIXO:` e Cidade `396 JOSE BONIFACIO - SP`.

A branch atual corrige apenas o parser do cabecalho W.Vetro, sem alterar itens, medidas ou confirmacao.

## VALIDAR ANTES DO MERGE
Usar `FELIPE ALVES SANTANA-861.pdf`.

1. Abrir `Medida Final` / `/producao/medicao-final`.
2. Clicar em `Nova medição`.
3. Selecionar o PDF 861.
4. Confirmar no preview:
   - Cliente: `FELIPE ALVES SANTANA`;
   - Cidade: `JOSE BONIFACIO - SP`;
   - `7 item(ns)`;
   - nenhum texto de rotulo como `CELULAR`, `TEL. FIXO` ou semelhante no campo Cliente;
   - nenhum trecho do CEP, como `396`, no campo Cidade.
5. Conferir que os 7 itens continuam exatamente como antes.
6. Confirmar que itens sem dimensoes continuam mostrando ausencia de medida, sem `0 x 0` como tamanho real.
7. Confirmar Build Validation verde no head final.
8. Mergear somente depois do build valido.

## DEPOIS DO MERGE
1. Continuar o teste de campo da Medicao Final 861.
2. Confirmar no detalhe:
   - Cliente `FELIPE ALVES SANTANA`;
   - Nome da obra `CASA`;
   - Orçamento `Nº 861`.
3. Validar preenchimento automatico do telefone do responsavel cadastrado e fallback manual.
4. Confirmar que `Cadastro > Dados da Empresa` fica vazio ate o usuario salvar configuracao manual.
5. Fazer regressao com `FRANCIS TESTE-977.pdf`, que possui dimensoes de referencia.
6. Criar a area dedicada `Configurações -> Orçamento` para dados da empresa, validade, pagamento, prazo, garantia, observacoes, rodape e futuras opcoes de layout.
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
- Kanban #104 a #111: fluxo de orçamento, fotos, leitura da trena, anexo W.Vetro, total automatico, moeda BRL e reenvio de anexos.
- PR #112: importacao de orçamento W.Vetro diretamente em `Nova medição`.
- PR #113: importacao de W.Vetro sem largura/altura, sem inventar dimensoes.
- PR #114: identificacao Cliente/Obra/Orçamento, telefone do responsavel e dados da empresa somente manuais.

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> build valido -> merge.
- PDF W.Vetro original deve ser preservado.
- Falta de largura/altura no PDF NAO e motivo para descartar uma esquadria identificavel.
- Nunca inventar dimensao ausente.
- Medida do orçamento W.Vetro NUNCA deve preencher automaticamente as seis medidas finais da obra.
- Nome da obra pode vir do PDF W.Vetro, mas nao deve ser confundido com endereco da obra.
- Dados da empresa so devem ser considerados configurados quando o usuario os salvar manualmente.
- Parser PDF continua sendo fallback; API estruturada deve ser preferida quando estiver disponivel e validada.
- Credenciais W.Vetro nunca devem ficar no browser.
- Leitura por IA da trena e sugestao; o colaborador deve conferir antes de salvar.
- Nao automatizar lista de corte antes de fechar o modelo de receitas e versoes.
