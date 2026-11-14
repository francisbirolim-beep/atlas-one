# Prévia da Central de Tarefas e Agenda — aprovação de fluxo

Data: 2026-11-14. Branch: `preview/central-tarefas-delegadas-20261114`.

## Estado da entrega
- Esta branch adiciona SOMENTE uma prévia interativa isolada em `/previa/central-tarefas-delegadas`, com exemplos fictícios e estado temporário em memória.
- Não há alteração de tabelas, RLS, APIs de produção, automações, autenticação nem dos quatro fluxos existentes do Kanban Pessoal.
- A tela serve para o proprietário validar organização, nomes e comportamentos pretendidos antes de autorizar a implantação funcional.
- NENHUMA das funcionalidades da prévia deve ser descrita como ativada para usuários em produção.

## Requisitos funcionais aprováveis
1. Na visão de Francis, a nova coluna **Pedidos de tarefa** contém tarefas criadas por ele e delegadas que ainda não foram iniciadas. Na visão de cada destinatário, essas mesmas tarefas aparecem em **A fazer**. Não criar uma cópia sem vínculo.
2. Ao responsável iniciar, a tarefa passa para **Em andamento** simultaneamente para criador e participantes. Se passar para **Aguardando**, refletir também. Se concluir, passar para **Concluído** para todos e registrar quem concluiu.
3. Múltiplos responsáveis no modo **compartilhado**: um único trabalho, apenas uma conclusão, sem duplicação de pagamento. Modo **individual**: criar ocorrências/subtarefas independentes por responsável; o criador acompanha cada conclusão separadamente.
4. Exibir prazo, prioridade, idade da tarefa, tempo restante ou em atraso, nomes dos responsáveis, último comentário e última movimentação; toda atividade com responsável e carimbo de data/hora.
5. Permitir comentário sem movimentar automaticamente a etapa; o criador vê quando recebeu comentário/resposta.
6. Avisos de nova atribuição e prazo no canto da tela: **Ver**, **OK, entendi** e **Adiar**. OK confirma leitura, não conclui. Avisos se repetem no horário definido, respeitando adiamento persistente e sem avalanche de notificações. Conclusão gera aviso ao criador e aos demais destinatários, sem repetição.
7. Mostrar **Concluídas** do mês selecionado por padrão; manter pendências antigas nas colunas abertas. Pesquisar e filtrar por período, responsável, prioridade, atraso e situação.
8. Criar tarefa manual ou compromisso da agenda para si ou múltiplos usuários, selecionados por busca de nome; compromissos aparecem nos calendários dos convidados. Aplicar permissões de criação/edição específicas e auditoria.
9. Recorrências: única, diária, semanal (dias selecionados), mensal (dia fixo), anual, 1º dia e N-ésimo dia útil do mês. Gerar cada ocorrência uma vez com chave idempotente. Alterar uma ocorrência não altera toda a série; oferecer 'somente esta' ou 'esta e próximas'.
10. Para quinto dia útil financeiro, definir o **calendário de dias úteis** (bancário vs. folha de pagamento), município/feriados e horário da empresa; não presumir que sábado é sempre dia útil.
11. Criação por voz: botão de microfone opcional em navegador compatível, transcrição exibida antes de salvar; usuário confirma data, horário, responsáveis e recorrência. Consentimento e permissões do navegador devem ser respeitados; formulário permanece opção completa.
12. Visão do criador para monitoramento: cards nas mesmas etapas por estado real, e visão filtrada de 'Delegadas por mim' para localizar tudo por responsável. Preservar as cores e a densidade dos cards aprovados.
13. Entrada em produção somente após migrações seguras, políticas de acesso por empresa, testes com 2+ usuários, teste de notificações em sessões diferentes, teste recorrência/feriados e autorização explícita do proprietário.

## Cenários obrigatórios de validação
- Francis cria pagamento compartilhado para Daiane e Gabrieli: aparece para as duas em A fazer e para Francis em Pedidos de tarefa; Daiane muda para Em andamento e Francis/Gabrieli observam; Gabrieli conclui e a tarefa encerra uma só vez.
- Francis cria tarefa individual para Daiane e Gabrieli: cada uma conclui a sua; progresso agregado correto.
- Daiane comenta 'aguardando boleto': todos veem a mensagem com autoria e horário; tarefa permanece na etapa correta.
- Criar recorrência mensal no 5º dia útil; testar mês com feriado e diferenças entre calendário bancário e folha.
- Não perder tarefa aberta de outubro ao abrir novembro; concluídas de outubro não aparecem sem mudar o período.
- Aviso adiado em um aparelho não reaparece prematuramente em outro.
- Sem alterações no Kanban Comercial, faturamento, orçamentos, estoque e outros módulos.

## Limites da prévia
A demonstração usa nomes, tarefas, ações e notificações simuladas. Não cria tarefas reais, não sincroniza contas conectadas, não dispara alertas e não calcula calendário de feriados reais. Essas funções pertencem à fase de implementação, após a aprovação do layout.
