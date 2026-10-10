-- Atlas One — detalhamento histórico dos itens de notas de entrada W.Vetro.
-- Somente consulta: não movimenta estoque, compras, custo, fornecedor ou financeiro oficiais.

alter table public.wvetro_historico_suprimentos
  drop constraint if exists wvetro_historico_suprimentos_tipo_registro_check;

alter table public.wvetro_historico_suprimentos
  add constraint wvetro_historico_suprimentos_tipo_registro_check
  check (tipo_registro in ('movimento_estoque','nota_entrada','item_nota_entrada'));

alter table public.wvetro_historico_suprimentos
  add column if not exists nota_chave_externa text null;

create index if not exists wvetro_historico_suprimentos_nota_item_idx
  on public.wvetro_historico_suprimentos (empresa_id, nota_id_wvetro, nota_chave_externa)
  where tipo_registro = 'item_nota_entrada';

comment on column public.wvetro_historico_suprimentos.nota_chave_externa is
  'Chave do cabeçalho histórico da NF W.Vetro associado ao item. Não cria vínculo com Compras/Estoque oficiais.';
