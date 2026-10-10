alter table public.orcamentos
  add column if not exists desconto numeric not null default 0 check (desconto >= 0),
  add column if not exists forma_pagamento text,
  add column if not exists prazo_entrega_dias integer check (prazo_entrega_dias is null or prazo_entrega_dias >= 0);

comment on column public.orcamentos.desconto is 'Desconto comercial aplicado ao orçamento balcão.';
comment on column public.orcamentos.forma_pagamento is 'Forma/condição de pagamento apresentada no orçamento.';
comment on column public.orcamentos.prazo_entrega_dias is 'Prazo de entrega informado em dias no orçamento.';
