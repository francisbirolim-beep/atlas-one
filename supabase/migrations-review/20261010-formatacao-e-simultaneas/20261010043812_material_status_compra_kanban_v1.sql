alter table public.pacote_tecnico_materiais
  add column if not exists status_compra text not null default 'necessidade',
  add column if not exists status_compra_atualizado_em timestamptz;

alter table public.pacote_tecnico_materiais
  drop constraint if exists pacote_tecnico_materiais_status_compra_check;

alter table public.pacote_tecnico_materiais
  add constraint pacote_tecnico_materiais_status_compra_check
  check (status_compra in ('necessidade','cotacao','aprovado','aguardando_entrega','recebido'));

create index if not exists idx_pacote_tecnico_materiais_status_compra
  on public.pacote_tecnico_materiais (pacote_id, status_compra)
  where excluido = false;