# Validação efêmera — colaboração/notificações — 2026-08-17

A migration `20260818013000_colaboracao_notificacoes_v1.sql` foi executada integralmente em PostgreSQL 16 efêmero com schema mínimo equivalente às tabelas atuais auditadas.

Validado:
- remoção da policy temporária permissiva de `tarefas` e `tarefa_colunas`;
- criação das novas policies próprias;
- criação de `notificacoes` e `notificacao_preferencias`;
- trigger de tarefa atribuída gerou exatamente uma notificação;
- trigger de convite de agenda gerou exatamente uma notificação;
- `notificacoes` foi adicionada à publication `supabase_realtime`.

Nenhuma operação foi executada no banco de produção por este teste.
