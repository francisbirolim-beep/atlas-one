# Kanban individual por venda — preparação de homologação (27/10/2026)

## Entrega isolada
Branch: `feat/kanban-obra-permissoes-20261027`. Não publicar em produção nem mesclar com main antes da homologação visual e da migração em banco de teste.

- Cliente 360 > venda > Visão geral agora possui Kanban individual com oito etapas e três tipos de cartão: venda real, compras reais vinculadas sem ambiguidade e acompanhamento manual.
- Vendas diferentes do mesmo cliente geram quadros separados, identificados por `vendaId`. Uma obra compartilhada por mais de uma venda não faz atribuição automática de compra a um orçamento.
- Pedido de estoque fica no Compras 360. Pedidos sem venda reconhecida também não aparecem como compra de uma obra.
- Cards manuais podem ser criados, movimentados, retirados (soft hide) e restaurados conforme permissões explícitas administradas pelo Master.
- Todos os movimentos manuais exigem motivo, empresa/venda válidas e trilha de auditoria transacional; dados operacionais NÃO são movidos via Kanban visual.
- Card principal da venda pode ser retirado/restaurado somente pelo Master, usando mecanismo já existente; não apaga venda ou pedidos.
- O quadro geral espelha cards manuais e continua exibindo dados operacionais derivados, atualizado a cada 15 segundos.
- Produtos de compra mostram `foto_url` real cadastrada; na ausência da foto, avisam "Imagem pendente" sem fabricar imagem fictícia.

## Permissões
Novas ações sob o módulo `kanban-obra` no setor `portal-cliente` em Configurações > Usuários: `clientes.kanban_obra.consultar`, `criar`, `mover`, `retirar`, `restaurar`.
Master integral. Para outros usuários, módulo e ação devem estar liberados explicitamente, respeitando o nível do setor.
As regras antigas permanecem.

## Banco
Migração aditiva **NÃO APLICADA** `supabase/migrations/20261027130007_kanban_obra_cards_auditados_20261027.sql`.
Cria duas tabelas (manual e histórico) RLS, serviço exclusivamente, RPC por empresa/venda/usuário. Não altera tabelas de compras/vendas/financeiro. A API retorna recurso indisponível até a migração existir.

## Verificações
`npm run typecheck`, `npm run build` em cópia isolada com variáveis fictícias e testes de Kanban/permissões foram executados com sucesso antes da publicação da branch. Build sem variáveis falhava em outra rota por `supabaseUrl is required`, situação resolvida com placeholders de teste; isso não valida banco real.

### Pendente antes de produção
1. Banco de homologação saudável (a branch existente de Supabase indica `MIGRATIONS_FAILED`). Aplicar e testar transações com ROLLBACK, isolation entre tenants, usuários Master/consulta/edição/sem permissão, auditoria e concorrência.
2. Testar visual com Francis no preview Vercel e usuários reais autorizados, incluindo compra de estoque, mesmo cliente/duas obras, múltiplas vendas na mesma obra e restauração.
3. Confirmar rotas do Cliente 360 e comportamento de fotos reais e ausência de duplicações.
4. Revisar PR, merge controlado com rollback. Produção atual deve continuar intacta até autorização explícita.
