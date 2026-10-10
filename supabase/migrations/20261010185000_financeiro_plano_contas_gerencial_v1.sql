-- Plano de contas para classificação GERENCIAL (não modifica lançamentos históricos).
create table if not exists public.financeiro_plano_contas (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 codigo text not null,
 nome text not null,
 grupo text not null check (grupo in ('receita','cmv','tributo','despesa_operacional','despesa_financeira','estoque','investimento','transferencia')),
 ativo boolean not null default true,
 criado_em timestamptz not null default now(),
 unique (empresa_id,codigo),
 unique (id,empresa_id)
);
create index if not exists idx_financeiro_plano_contas_empresa on public.financeiro_plano_contas(empresa_id,codigo);
alter table public.financeiro_plano_contas enable row level security;
revoke all on public.financeiro_plano_contas from anon,authenticated;
grant select,insert,update,delete on public.financeiro_plano_contas to service_role;

create table if not exists public.financeiro_conta_classificacoes (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null,
 conta_pagar_id uuid not null references public.financeiro_contas_pagar(id) on delete cascade,
 plano_conta_id uuid not null,
 classificado_por_id uuid,
 classificado_por_nome text,
 classificado_em timestamptz not null default now(),
 unique (empresa_id,conta_pagar_id),
 constraint financeiro_classificacao_conta_escopo
  foreign key (plano_conta_id,empresa_id) references public.financeiro_plano_contas(id,empresa_id)
);
create index if not exists idx_financeiro_conta_classificacoes_empresa on public.financeiro_conta_classificacoes(empresa_id,plano_conta_id);
alter table public.financeiro_conta_classificacoes enable row level security;
revoke all on public.financeiro_conta_classificacoes from anon,authenticated;
grant select,insert,update,delete on public.financeiro_conta_classificacoes to service_role;

-- Gatilho impede referenciar conta a pagar de outra empresa, mesmo com service-role.
create or replace function public.fn_financeiro_classificacao_escopo()
returns trigger
language plpgsql
set search_path=public
as $$
begin
 if not exists(
   select 1 from public.financeiro_contas_pagar p
   where p.id=new.conta_pagar_id and p.empresa_id=new.empresa_id
 ) then
   raise exception 'Conta a pagar não pertence à empresa informada';
 end if;
 return new;
end;
$$;
revoke execute on function public.fn_financeiro_classificacao_escopo() from public,anon,authenticated;
drop trigger if exists trg_financeiro_classificacao_escopo on public.financeiro_conta_classificacoes;
create trigger trg_financeiro_classificacao_escopo
before insert or update of empresa_id,conta_pagar_id on public.financeiro_conta_classificacoes
for each row execute function public.fn_financeiro_classificacao_escopo();
