# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Home white-label + logo da empresa + tema + tipo livre

Após deploy desta implementação:
1. entrar com usuário master e abrir `Configurações > Empresa e Identidade`;
2. confirmar que a tela carrega o nome já salvo da empresa sem apagar CNPJ, endereço, telefones, e-mail ou condições comerciais existentes;
3. preencher nome fantasia e enviar um logo PNG/JPG/WebP de até 5 MB;
4. alterar a cor principal e confirmar que a prévia da faixa muda;
5. salvar e voltar para a Home;
6. confirmar que a faixa principal mostra o nome fantasia/nome da empresa e o logo enviado;
7. confirmar que `Novo orçamento`, `Novo cliente`, `Nova tarefa` e `Novo compromisso` aparecem como quatro atalhos abaixo da faixa;
8. confirmar que `Últimos orçamentos` mostra até 3 pedidos recentes com número, cliente, valor, status e data;
9. alternar para `Tema claro` e confirmar que a faixa continua colorida, enquanto `Últimos orçamentos`, `Notificações e alertas`, `Minhas tarefas` e `Agenda / Calendário` ficam claros;
10. atualizar a página e confirmar que tema, logo e identidade continuam persistidos;
11. alternar para `Tema escuro` e confirmar legibilidade da faixa, do painel de últimos orçamentos e dos demais painéis;
12. abrir `Orçamentos` e iniciar um novo pedido;
13. preencher `Tipo de esquadria / descrição livre`, deixar Linha e Modelo / Tipologia vazios, completar os demais campos obrigatórios e confirmar envio normal;
14. testar também descrição livre + Linha opcional, sem Modelo;
15. confirmar que, ao escolher uma Tipologia cadastrada, o texto livre é limpo e o fluxo técnico continua como antes.

Não criar migration para nenhuma dessas validações. A identidade da empresa usa a configuração JSON `dados_empresa` e o bucket `fotos` já existentes; o tema permanece salvo no navegador por usuário; o tipo livre usa `tipo = outro` + `tipoOutroTexto`.

Pendência independente: localizar desenho técnico exato do TMC antes de exibi-lo no Plano de Corte.