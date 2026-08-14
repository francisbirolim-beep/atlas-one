# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
Validar a branch `fix/medicao-link-telefone-responsavel`, criada a partir dos primeiros testes reais da Medicao Final importada do W.Vetro.

A PR #113 ja esta em `main` e permite importar `FELIPE ALVES SANTANA-861.pdf` com 7 itens mesmo sem largura/altura no documento. Os ajustes atuais sao de usabilidade/identificacao antes de continuar o teste de campo.

## VALIDAR ANTES DE ENCERRAR ESTA CORRECAO
Usar a Medicao Final ja criada a partir do orçamento W.Vetro `861`.

1. Abrir a Medicao Final detalhada.
2. Confirmar a nova faixa de identificacao no topo:
   - Cliente: `FELIPE ALVES SANTANA`;
   - Nome da obra: `CASA`;
   - Orçamento: `Nº 861`.
3. Confirmar que o numero mostrado e o numero W.Vetro, nao apenas o serial interno do Atlas.
4. No seletor `Responsável pela medição`, selecionar um usuario que tenha WhatsApp cadastrado.
5. No bloco `Link externo da Medicao Final`, confirmar que:
   - o nome do responsavel aparece automaticamente;
   - o telefone/WhatsApp cadastrado aparece automaticamente;
   - o telefone continua editavel.
6. Selecionar/digitar uma pessoa sem telefone cadastrado e confirmar que o campo fica livre para preenchimento manual.
7. Gerar um link externo e confirmar que nome e telefone gravados no acesso correspondem ao que estava no formulario.
8. Abrir `Cadastro > Dados da Empresa` e confirmar que dados antigos/seedados nao aparecem como se tivessem sido configurados pelo usuario.
9. Preencher e salvar um dado de empresa manualmente; recarregar e confirmar que somente o que foi salvo manualmente volta a aparecer.
10. Confirmar Build Validation verde no head final antes do merge.

## CONTINUAR TESTE DA IMPORTACAO W.VETRO
Depois desses detalhes:
1. Conferir os 7 itens da Medicao Final `861`.
2. Confirmar que `Largura Baixo/Meio/Cima` e `Altura Direita/Meio/Esquerda` permanecem vazias ate a medicao real da obra.
3. Confirmar que o PDF original W.Vetro continua preservado.
4. Reimportar `861` e confirmar bloqueio de duplicidade.
5. Fazer regressao com `FRANCIS TESTE-977.pdf`, que possui dimensoes de referencia.

## DEPOIS DESTA CORRECAO
1. Criar a area dedicada `Configurações -> Orçamento` para dados da empresa, validade, pagamento, prazo, garantia, observacoes, rodape e futuras opcoes de layout.
2. Fazer todos os PDFs Atlas consumirem somente configuracoes salvas pelo usuario, sem textos/empresa hardcoded.
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
- PR #113: importacao de W.Vetro sem largura/altura, sem inventar dimensoes.

## CUIDADOS
- GitHub e a única fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> build válido -> merge.
- PDF W.Vetro original deve ser preservado.
- Falta de largura/altura no PDF NÃO é motivo para descartar uma esquadria identificável.
- Nunca inventar dimensão ausente.
- Medida do orçamento W.Vetro NUNCA deve preencher automaticamente as seis medidas finais da obra.
- Nome da obra pode vir do PDF W.Vetro, mas nao deve ser confundido com endereco da obra.
- Dados da empresa so devem ser considerados configurados quando o usuario os salvar manualmente.
- Parser PDF continua sendo fallback; API estruturada deve ser preferida quando estiver disponível e validada.
- Credenciais W.Vetro nunca devem ficar no browser.
- Leitura por IA da trena é sugestão; o colaborador deve conferir antes de salvar.
- Não automatizar lista de corte antes de fechar o modelo de receitas e versões.
