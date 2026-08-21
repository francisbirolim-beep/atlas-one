# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Home da Keila + tema claro completo + tipo livre

Após deploy desta implementação:
1. entrar com a usuária Keila e abrir a Home em uma largura próxima de 1000 px;
2. confirmar que `Visão central da operação` não fica mais espremido palavra por palavra;
3. confirmar que `Novo orçamento`, `Nova tarefa` e `Novo compromisso` aparecem abaixo do texto nessa largura e voltam para a lateral apenas em telas maiores;
4. na sidebar, clicar em `Tema claro` e confirmar que ficam claros e legíveis: sidebar, bloco principal da Home, `Notificações e alertas`, `Minhas tarefas` e `Agenda / Calendário`;
5. confirmar que bordas, áreas internas e botões neutros desses cards também ficam claros, mantendo verdes/azuis/vermelhos/violetas apenas para ações e status;
6. atualizar a página e confirmar que a escolha de tema permanece para a mesma usuária;
7. alternar de volta para `Tema escuro` e confirmar que a preferência também persiste;
8. validar que o título `Atlas One` e o nome do usuário continuam legíveis na sidebar escura;
9. abrir `Orçamentos` e iniciar um novo pedido;
10. em uma esquadria, preencher `Tipo de esquadria / descrição livre`, por exemplo `Porta de correr 3 folhas - Linha Suprema`;
11. deixar Linha e Modelo / Tipologia vazios, preencher os demais campos obrigatórios e confirmar que o pedido é enviado normalmente;
12. testar também descrição livre + Linha opcional, sem Modelo;
13. confirmar que, ao escolher uma Tipologia cadastrada, o texto livre é limpo e o fluxo técnico continua como antes.

Não criar migration para nenhuma dessas validações. O tema é persistido no navegador por usuário, e o tipo livre usa `tipo = outro` + `tipoOutroTexto`.

Pendência independente: localizar desenho técnico exato do TMC antes de exibi-lo no Plano de Corte.
