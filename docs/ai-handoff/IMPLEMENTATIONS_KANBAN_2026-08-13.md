# Implementação — Kanban orçamento

Correção aplicada na branch `fix/kanban-iniciar-e-foto-pedido`:

- a rota `/kanban` passa a usar o componente corrigido `components/system/KanbanPageFixed.tsx`;
- removida a exceção que permitia ao criador do pedido editar antes de iniciar o orçamento;
- mantida a lógica de **Retornar orçamento** quando já existe `orcamento_iniciado_em`;
- fotos existentes do item são reunidas a partir de `foto_url`, `foto_urls`, `foto_larguras_url` e `foto_alturas_url`, preservando a referência original;
- nenhuma leitura automática da trena foi adicionada nesta etapa.
