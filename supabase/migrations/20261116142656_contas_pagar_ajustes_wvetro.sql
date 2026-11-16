-- Complemento aditivo de contas a pagar. Sem alterar títulos, status ou pagamentos existentes.
-- Aplicar em homologação antes da publicação em produção, com backup e revisão.
alter table public.financeiro_contas_pagar
  add column if not exists valor_desconto numeric(14,2) not null default 0,
  add column if not exists valor_juros numeric(14,2) not null default 0,
  add column if not exists valor_multa numeric(14,2) not null default 0,
  add column if not exists valor_troco numeric(14,2) not null default 0;

alter table public.financeiro_contas_pagar
  drop constraint if exists financeiro_contas_pagar_ajustes_nao_negativos;
alter table public.financeiro_contas_pagar
  add constraint financeiro_contas_pagar_ajustes_nao_negativos
  check (
    valor_desconto >= 0 and valor_juros >= 0 and valor_multa >= 0
    and valor_troco >= 0 and valor_desconto <= valor
  );

comment on column public.financeiro_contas_pagar.valor_desconto is 'Abatimento concedido pelo fornecedor no pagamento.';
comment on column public.financeiro_contas_pagar.valor_juros is 'Juros acrescidos à obrigação paga.';
comment on column public.financeiro_contas_pagar.valor_multa is 'Multa acrescida à obrigação paga.';
comment on column public.financeiro_contas_pagar.valor_troco is 'Dinheiro devolvido pelo fornecedor; já descontado de valor_pago líquido.';
