# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
No Kanban comercial, PRs #104 a #109 estabilizaram o fluxo de inicio do orcamento, preservacao/identificacao das fotos, leitura automatica das medidas da trena e anexo original do W.Vetro.

A branch atual `fix/pdf-valor-e-reenvio-anexos` implementa o preenchimento automatico do valor total a partir do PDF anexado.

## VALIDAR ANTES DE ENCERRAR ESTA ETAPA
1. Abrir um card em `Fazer orçamento` e clicar em `Iniciar orçamento`/`Retornar orçamento`.
2. Ir ate `Elaboração do orçamento` > `Anexos do orçamento`.
3. Anexar o PDF real `FRANCIS TESTE-977.pdf`.
4. Confirmar que o anexo continua sendo salvo normalmente.
5. Confirmar que `Valor total do orçamento` e preenchido automaticamente com o equivalente numerico de `R$ 2.716,84`.
6. Confirmar que aparece aviso `Valor lido automaticamente do PDF: R$ 2.716,84`.
7. Confirmar que o campo continua editavel manualmente.
8. Confirmar que fotos, leitura da trena e `Iniciar/Retornar orçamento` nao sofreram regressao.

## PROXIMAS TAREFAS — ORCAMENTO ATLAS
1. Corrigir a formatacao monetaria do PDF Atlas para padrao brasileiro (`R$ 2.716,84`).
2. Adicionar `Enviar ao vendedor` / `Reenviar` em cada anexo para permitir novas tentativas sem depender da finalizacao unica.
3. Criar `Configurações -> Orçamento` usando `configuracoes_gerais` para:
   - nome da empresa, CNPJ, IE, endereco, cidade/UF, CEP, telefone e email;
   - validade da proposta;
   - condicoes de pagamento;
   - prazo de entrega/instalacao;
   - garantia;
   - observacoes padrao e rodape.
4. Fazer o PDF atual do Atlas consumir essas configuracoes.
5. Melhorar o layout profissional do PDF mantendo o modelo atual como base.
6. Depois evoluir para leitura estruturada do W.Vetro (itens, descricoes, valores e condicoes) com tela de revisao humana antes de gravar dados definitivos.

## DEPOIS DO ORCAMENTO ATLAS
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

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> build valido -> merge.
- PDF W.Vetro original deve ser preservado, nao substituido pelo PDF Atlas.
- Leitura automatica do total deve permanecer conferivel/editavel pelo colaborador.
- Parser W.Vetro de itens precisa de revisao humana antes de alimentar dados definitivos.
- Leitura por IA da trena e sugestao; o colaborador deve conferir as medidas antes de salvar.
- Nao sobrescrever automaticamente medida manual ja preenchida.
- Nao automatizar lista de corte antes de fechar o modelo de receitas e versoes.

## EM VALIDACAO — MOEDA E ANEXOS
1. Confirmar no card `R$ 2.716,84`.
2. Confirmar no campo de valor `R$ 2.716,84`.
3. Gerar novo PDF Atlas e confirmar `Valor total: R$ 2.716,84`.
4. Testar `Enviar`/`Reenviar` na frente de cada anexo.
5. Depois seguir para `Configurações -> Orçamento` e evolucao do layout profissional.
