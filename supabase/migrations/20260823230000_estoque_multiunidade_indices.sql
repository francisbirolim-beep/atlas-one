-- Atlas One — índices para consultas operacionais do estoque em rede.

create index if not exists idx_estoque_saldos_endereco
  on public.estoque_saldos(endereco_id)
  where endereco_id is not null;

create index if not exists idx_estoque_reservas_local_status
  on public.estoque_reservas(local_id,status);
create index if not exists idx_estoque_reservas_endereco
  on public.estoque_reservas(endereco_id)
  where endereco_id is not null;
create index if not exists idx_estoque_reservas_cliente
  on public.estoque_reservas(cliente_id)
  where cliente_id is not null;
create index if not exists idx_estoque_reservas_criado_por
  on public.estoque_reservas(criado_por_id)
  where criado_por_id is not null;

create index if not exists idx_estoque_transferencias_origem_status
  on public.estoque_transferencias(local_origem_id,status);
create index if not exists idx_estoque_transferencias_destino_status
  on public.estoque_transferencias(local_destino_id,status);
create index if not exists idx_estoque_transferencias_solicitado_por
  on public.estoque_transferencias(solicitado_por_id)
  where solicitado_por_id is not null;
create index if not exists idx_estoque_transferencias_recebido_por
  on public.estoque_transferencias(recebido_por_id)
  where recebido_por_id is not null;

create index if not exists idx_estoque_transferencia_itens_transferencia
  on public.estoque_transferencia_itens(transferencia_id);
create index if not exists idx_estoque_transferencia_itens_produto
  on public.estoque_transferencia_itens(produto_id);
create index if not exists idx_estoque_transferencia_itens_endereco_origem
  on public.estoque_transferencia_itens(endereco_origem_id)
  where endereco_origem_id is not null;
create index if not exists idx_estoque_transferencia_itens_endereco_destino
  on public.estoque_transferencia_itens(endereco_destino_id)
  where endereco_destino_id is not null;

create index if not exists idx_estoque_movimentos_local_origem
  on public.estoque_movimentos(local_origem_id,created_at desc)
  where local_origem_id is not null;
create index if not exists idx_estoque_movimentos_local_destino
  on public.estoque_movimentos(local_destino_id,created_at desc)
  where local_destino_id is not null;
create index if not exists idx_estoque_movimentos_endereco_origem
  on public.estoque_movimentos(endereco_origem_id)
  where endereco_origem_id is not null;
create index if not exists idx_estoque_movimentos_endereco_destino
  on public.estoque_movimentos(endereco_destino_id)
  where endereco_destino_id is not null;
