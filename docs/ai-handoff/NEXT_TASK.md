# NEXT_TASK.md — Atlas One

## TAREFA ATUAL
No Kanban comercial, PRs #104 a #108 estabilizaram o fluxo de inicio do orcamento, preservacao/identificacao das fotos de campo e leitura automatica das medidas da trena.

A branch atual `feat/anexo-wvetro-kanban` libera o anexo do PDF original do W.Vetro sem exigir digitacao manual de titulo.

## VALIDAR ANTES DE ENCERRAR ESTA ETAPA
1. Abrir um card em `Fazer orçamento` e clicar em `Iniciar orçamento`/`Retornar orçamento`.
2. Ir ate `Elaboração do orçamento` > `Anexos do orçamento`.
3. Confirmar que o campo de titulo aparece preenchido automaticamente com `Orçamento W.Vetro (original)`.
4. Confirmar que o botao `Anexar` esta liberado imediatamente.
5. Selecionar o PDF gerado pelo W.Vetro e confirmar que ele aparece na lista de anexos.
6. Finalizar/salvar, fechar e reabrir o card; confirmar que o anexo original continua disponivel.
7. Confirmar que o fluxo das fotos, medidas e `Iniciar/Retornar orçamento` nao sofreu regressao.

## PROXIMA TAREFA — ESPELHO DO ORCAMENTO W.VETRO
Depois de validar o upload original:
1. identificar o anexo `Orçamento W.Vetro (original)` como fonte;
2. extrair do PDF cliente, itens/esquadrias, ambientes, descricoes, quantidades, medidas, valores e condicoes comerciais;
3. nunca assumir leitura perfeita: criar tela de revisao/confirmacao antes de gravar os dados estruturados;
4. usar os dados revisados para gerar um `Orçamento Atlas` com identidade visual da Esquadrifacio e conteudo comercial equivalente ao W.Vetro;
5. manter o PDF W.Vetro original armazenado para auditoria/comparacao;
6. ao finalizar o orcamento, disponibilizar o PDF Atlas para envio ao vendedor;
7. evitar duplicar o PDF Atlas a cada reabertura/finalizacao do mesmo orcamento.

## DEPOIS DO ESPELHO W.VETRO
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

## CUIDADOS
- GitHub e a unica fonte da verdade.
- Nunca commitar direto na `main`; branch -> PR -> build valido -> merge.
- PDF W.Vetro original deve ser preservado, nao substituido pelo PDF Atlas.
- Parser W.Vetro precisa de revisao humana antes de alimentar itens/valores definitivos.
- Leitura por IA da trena e sugestao; o colaborador deve conferir as medidas antes de salvar.
- Nao sobrescrever automaticamente medida manual ja preenchida.
- Nao automatizar lista de corte antes de fechar o modelo de receitas e versoes.
