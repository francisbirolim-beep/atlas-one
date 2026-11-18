-- Modelo de recibo de adiantamento: tabelas inteiramente isoladas dos holerites e financeiro.
create table if not exists public.rh_adiantamentos (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 rh_pessoa_id uuid references public.rh_pessoas(id) on delete set null,
 funcionario_nome text not null check (char_length(trim(funcionario_nome)) >= 3),
 competencia text not null check (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 dados jsonb not null default '{}'::jsonb check (jsonb_typeof(dados) = 'object'),
 total_vencimentos numeric(14,2) not null default 0 check (total_vencimentos >= 0),
 total_descontos numeric(14,2) not null default 0 check (total_descontos >= 0),
 valor_liquido numeric(14,2) not null default 0 check (valor_liquido >= 0),
 situacao text not null default 'rascunho' check (situacao in ('rascunho','emitido')),
 criado_por_id uuid,
 criado_por_nome text,
 emitido_em timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint rh_adiantamento_total_confere check (valor_liquido = total_vencimentos - total_descontos)
);
create index if not exists idx_rh_adiantamentos_empresa_competencia on public.rh_adiantamentos (empresa_id, competencia desc, created_at desc);
alter table public.rh_adiantamentos enable row level security;
revoke all on public.rh_adiantamentos from anon, authenticated;
grant select, insert, update on public.rh_adiantamentos to service_role;
