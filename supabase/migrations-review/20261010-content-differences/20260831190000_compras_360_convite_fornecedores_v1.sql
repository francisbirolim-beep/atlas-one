-- Compras 360: permitir cotação "convidada" (fornecedor selecionado, preço ainda não informado).

alter table public.compras_cotacoes
  alter column preco_unitario drop not null;
