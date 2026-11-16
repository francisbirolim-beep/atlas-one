-- Contas a Pagar: ajuste financeiro aditivo, sem alterar pagamentos existentes.
-- DDL com lock_timeout para desistir rapidamente se houver operação concorrente.
set local lock_timeout = '2s';
set local statement_timeout = '30s';

alter table public.financeiro_contas_pagar
  add column if not exists valor_desconto numeric(14,2) not null default 0,
  add column if not exists valor_juros numeric(14,2) not null default 0,
  add column if not exists valor_multa numeric(14,2) not null default 0,
  add column if not exists valor_troco numeric(14,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.financeiro_contas_pagar'::regclass
      and conname = 'financeiro_contas_pagar_ajustes_nao_negativos'
  ) then
    alter table public.financeiro_contas_pagar
      add constraint financeiro_contas_pagar_ajustes_nao_negativos
      check (
        valor_desconto >= 0 and valor_juros >= 0 and valor_multa >= 0
        and valor_troco >= 0 and valor_desconto <= valor
      ) not valid;
  end if;
end;
$$;

alter table public.financeiro_contas_pagar
  validate constraint financeiro_contas_pagar_ajustes_nao_negativos;

comment on column public.financeiro_contas_pagar.valor_desconto is 'Abatimento concedido pelo fornecedor no pagamento.';
comment on column public.financeiro_contas_pagar.valor_juros is 'Juros acrescidos à obrigação paga.';
comment on column public.financeiro_contas_pagar.valor_multa is 'Multa acrescida à obrigação paga.';
comment on column public.financeiro_contas_pagar.valor_troco is 'Dinheiro devolvido pelo fornecedor; já descontado de valor_pago líquido.';
