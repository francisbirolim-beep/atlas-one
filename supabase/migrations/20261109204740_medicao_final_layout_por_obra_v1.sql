-- Configuração de impressão A4 específica de uma obra. O modelo geral permanece intacto.
-- A leitura/escrita ocorre apenas via API autenticada, com isolamento por empresa.
create table if not exists public.medicao_final_layouts_obras (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  configuracao jsonb not null default '{}'::jsonb,
  atualizado_por uuid references public.usuarios(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (empresa_id, obra_id)
);

create index if not exists medicao_final_layouts_obras_obra_idx
  on public.medicao_final_layouts_obras(obra_id);

alter table public.medicao_final_layouts_obras enable row level security;
revoke all on public.medicao_final_layouts_obras from public, anon, authenticated;
comment on table public.medicao_final_layouts_obras is
  'Override de impressão A4 por obra, sem modificar a medição nem o padrão geral da empresa.';
