# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar tipo livre no Orçamento Rápido

Após deploy desta implementação:
1. abrir `Orçamentos` e iniciar um novo pedido;
2. em uma esquadria, preencher `Tipo de esquadria / descrição livre`, por exemplo `Porta de correr 3 folhas - Linha Suprema`;
3. deixar Linha e Modelo / Tipologia vazios;
4. preencher medidas, quantidade e demais campos obrigatórios do orçamento;
5. confirmar que o pedido é enviado normalmente e que a descrição livre aparece no item salvo;
6. testar também descrição livre + Linha opcional, sem Modelo;
7. confirmar que, ao escolher uma Tipologia cadastrada, o texto livre é limpo e o fluxo técnico continua como antes.

Não criar migration para esta tarefa. O fluxo usa os campos já existentes `tipo = outro` + `tipoOutroTexto`.

Pendência independente: localizar desenho técnico exato do TMC antes de exibi-lo no Plano de Corte.
