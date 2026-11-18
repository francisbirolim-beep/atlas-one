-- Holerites manuais do RH: estrutura aditiva, sem alterar folha ou financeiro existentes.
-- Aplicar primeiramente em banco isolado de homologacao.
create table if not exists public.rh_holerites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  rh_pessoa_id uuid not null references public.rh_pessoas(id) on delete restrict,
  competencia text not null check (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])),
  empresa_nome text not null default '',
  empresa_documento text,
  nome_funcionario text not null,
  cpf_funcionario text,
  cargo_funcionario text,
  setor_funcionario text,
  salario_base numeric(14,2),
  data_pagamento date,
  itens jsonb not null default '[]'::jsonb check (jsonb_typeof(itens) = 'array'),
  total_proventos numeric(14,2) not null default 0 check (total_proventos >= 0),
  total_descontos numeric(14,2) not null default 0 check (total_descontos >= 0),
  valor_liquido numeric(14,2) not null default 0 check (valor_liquido >= 0),
  observacoes text,
  situacao text not null default 'rascunho' check (situacao in ('rascunho', 'emitido')),
  criado_por_id uuid,
  criado_por_nome text,
  emitido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rh_holerites_empresa_competencia
  on public.rh_holerites (empresa_id,competencia desc,created_at desc);
create index if not exists idx_rh_holerites_empresa_pessoa
  on public.rh_holerites (empresa_id,rh_pessoa_id);
alter table public.rh_holerites enable row level security;
revoke all on public.rh_holerites from anon, authenticated;
grant select, insert, update on public.rh_holerites to service_role;
),
  empresa_nome text not null default '',
  empresa_documento text,
  nome_funcionario text not null,
  cpf_funcionario text,
  cargo_funcionario text,
  setor_funcionario text,
  salario_base numeric(14,2),
  data_pagamento date,
  itens jsonb not null default '[]'::jsonb check (jsonb_typeof(itens) = 'array'),
  total_proventos numeric(14,2) not null default 0 check (total_proventos >= 0),
  total_descontos numeric(14,2) not null default 0 check (total_descontos >= 0),
  valor_liquido numeric(14,2) not null default 0 check (valor_liquido >= 0),
  observacoes text,
  situacao text not null default 'rascunho' check (situacao in ('rascunho', 'emitido')),
  criado_por_id uuid,
  criado_por_nome text,
  emitido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rh_holerites_empresa_competencia
  on public.rh_holerites (empresa_id,competencia desc,created_at desc);
create index if not exists idx_rh_holerites_empresa_pessoa
  on public.rh_holerites (empresa_id,rh_pessoa_id);
alter table public.rh_holerites enable row level security;
revoke all on public.rh_holerites from anon, authenticated;
grant select, insert, update on public.rh_holerites to service_role;
