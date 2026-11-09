-- Layout de impressão da medição final, isolado por empresa.
-- Somente rotas autenticadas com escopo de empresa acessam os dados (service role).
create table if not exists public.medicao_final_layouts (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  configuracao jsonb not null default '{}'::jsonb,
  atualizado_por uuid references public.usuarios(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.medicao_final_layouts enable row level security;
revoke all on public.medicao_final_layouts from anon, authenticated;
comment on table public.medicao_final_layouts is 'Padrão A4 de medição final por empresa, sem alteração nas medições.';
