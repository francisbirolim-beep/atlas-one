# Próxima validação — Cliente 360 painel principal

Validar no preview e em produção após merge:

1. abrir um cliente existente em `/clientes/[id]`;
2. conferir cabeçalho e indicadores financeiros;
3. abrir as abas de Obras, Orçamentos e Vendas, Financeiro, Assistências, Documentos e Histórico;
4. registrar um recebimento de teste vinculado a uma obra com parcelas em aberto;
5. confirmar que recebimento parcial aumenta `valor_pago` sem quitar a parcela;
6. confirmar que recebimento total quita a parcela e preserva o histórico;
7. criar nova ação a partir do cliente e confirmar que o `cliente_id` permanece o mesmo;
8. confirmar que Balcão e venda balcão continuam fora do Kanban de obras.
