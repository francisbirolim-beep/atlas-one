-- Unidade operacional pendente sem inventar conversão.
begin;

alter table public.produtos
  alter column unidade drop not null;

comment on column public.produtos.unidade is
  'Unidade operacional/canônica usada pelo Atlas. NULL significa unidade operacional ainda não definida; consultar unidade_origem apenas como dado da fonte, sem inferir conversão.';

commit;
