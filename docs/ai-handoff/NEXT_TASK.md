# NEXT_TASK.md — Atlas One

## TAREFA ATUAL — validar Home por usuário + Assistência + Ordem de Serviço

Após deploy desta implementação:
1. confirmar que o botão verde `+ Novo` não aparece mais na barra superior e que o atalho `Novo orçamento` permanece na Home;
2. como Master, abrir `Configurações > Usuários e Acesso`;
3. criar um usuário de teste e marcar somente os módulos que deverão aparecer em sua Home;
4. entrar com esse usuário e confirmar que a Home mostra somente os blocos escolhidos;
5. voltar como Master, alterar a composição desse usuário e confirmar a mudança após atualizar a Home dele;
6. configurar a usuária Keila com `Orçamentos`, `Kanban comercial`, `Minhas tarefas`, `Calendário`, `Notificações` e `Assistências`, selecionando `Todas as assistências` quando ela precisar acompanhar a operação completa;
7. configurar um usuário de vendedor com Assistências em `Somente as assistências abertas por ele`;
8. como vendedor, abrir `Assistências` e confirmar que só aparecem os chamados criados por esse vendedor;
9. como Keila/Master ou usuário configurado com `Todas`, confirmar que aparecem todos os chamados;
10. clicar em `Nova assistência` e testar a busca de cliente já cadastrado pelo nome;
11. confirmar que selecionar um cliente preenche telefone/WhatsApp, cidade, endereço e bairro quando esses dados existirem;
12. abrir uma assistência informando somente o nome do cliente e confirmar que o cadastro é aceito;
13. testar também uma assistência completa com descrição e fotos;
14. confirmar que o novo chamado entra no Kanban de Assistências;
15. mover o chamado entre as etapas do Kanban e confirmar persistência após atualizar a página;
16. abrir o chamado, clicar em `Gerar ordem de serviço` e validar dados da empresa, logo, cliente, endereço, problema, fotos, etapa e responsável pela abertura;
17. usar `Imprimir / Salvar PDF` e confirmar que a OS sai limpa em A4 sem navegação do Atlas;
18. validar os campos em branco da OS para técnico, data de atendimento, serviço realizado, materiais/peças, observações e assinaturas;
19. alternar tema claro/escuro e confirmar que os novos blocos de Home permanecem legíveis;
20. confirmar que a navegação lateral possui `Assistências` e que `Usuários e Acesso` substituiu o rótulo antigo `Usuários e Senhas`.

Esta implementação não exige migration: a composição da Home e o escopo de Assistências usam `configuracoes_gerais`; os chamados continuam na tabela `assistencias` e no Kanban de Assistências já existente.

Pendência independente: localizar desenho técnico exato do TMC antes de exibi-lo no Plano de Corte.