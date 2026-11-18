-- Atlas One — cadastro de pessoas de RH integrado a lançamentos manuais.
-- Aditivo: não altera títulos existentes, fornecedores ou clientes.
create table if not exists public.rh_pessoas (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id) on delete cascade,
 nome text not null check (length(trim(nome)) >= 3),
 tipo text not null check (tipo in ('funcionario','prestador','terceiro','fornecedor')),
 cpf_cnpj text,
 telefone text,
 email text,
 endereco text,
 cargo text,
 setor text,
 data_admissao date,
 salario_base numeric(14,2) check (salario_base is null or salario_base >= 0),
 observacoes text,
 ativo boolean not null default true,
 criado_por_id uuid,
 criado_por_nome text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists idx_rh_pessoas_empresa_tipo_nome on public.rh_pessoas(empresa_id,tipo,nome);
create unique index if not exists uq_rh_pessoas_empresa_documento
 on public.rh_pessoas(empresa_id,regexp_replace(cpf_cnpj,'[^0-9]','','g'))
 where cpf_cnpj is not null and length(regexp_replace(cpf_cnpj,'[^0-9]','','g')) in (11,14);
alter table public.rh_pessoas enable row level security;
-- RH contém dados pessoais e salariais: acesso exclusivamente pela API autenticada.
revoke all on public.rh_pessoas from anon, authenticated;
grant select, insert, update on public.rh_pessoas to service_role;

alter table public.financeiro_contas_pagar
 add column if not exists rh_pessoa_id uuid references public.rh_pessoas(id) on delete set null;
alter table public.financeiro_contas_receber
 add column if not exists rh_pessoa_id uuid references public.rh_pessoas(id) on delete set null;
create index if not exists idx_fin_pagar_empresa_rh_pessoa on public.financeiro_contas_pagar(empresa_id,rh_pessoa_id) where rh_pessoa_id is not null;
create index if not exists idx_fin_receber_empresa_rh_pessoa on public.financeiro_contas_receber(empresa_id,rh_pessoa_id) where rh_pessoa_id is not null;
