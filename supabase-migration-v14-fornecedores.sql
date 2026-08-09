-- Cadastro completo de Fornecedores (Fase 9a): usado para vincular precos
-- pagos por produto e, futuramente, importar notas fiscais. Idempotente:
-- pode rodar de novo sem erro.

create table if not exists fornecedores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nome text not null,
  cnpj_cpf text,
  contato text,
  telefone text,
  email text,
  endereco text,
  cidade text,
  observacoes text,
  ativo boolean not null default true,
  criado_por_id uuid,
  criado_por_nome text
);

alter table fornecedores enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'fornecedores' and policyname = 'acesso_total_temporario'
  ) then
    create policy "acesso_total_temporario" on fornecedores for all using (true) with check (true);
  end if;
end $$;
