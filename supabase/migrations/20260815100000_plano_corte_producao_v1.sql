-- Plano de corte da Produção
-- Gera um snapshot editável por plano a partir do produto/tipologia/receita técnica.

create table if not exists public.planos_corte (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references public.produtos(id) on delete set null,
  tipologia_id uuid references public.tipologias(id) on delete set null,
  receita_id uuid references public.engenharia_receitas(id) on delete set null,
  nome text not null,
  largura_mm numeric,
  altura_mm numeric,
  quantidade numeric not null default 1,
  folga_largura_mm numeric not null default 4,
  folga_altura_mm numeric not null default 4,
  variaveis jsonb not null default '{}'::jsonb,
  observacoes text,
  status text not null default 'rascunho' check (status in ('rascunho','liberado')),
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plano_corte_componentes (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.planos_corte(id) on delete cascade,
  receita_componente_id uuid references public.engenharia_receita_componentes(id) on delete set null,
  tipo text not null,
  produto_id uuid references public.produtos(id) on delete set null,
  nome text not null,
  unidade text not null default 'un',
  quantidade numeric not null default 1,
  corte_mm numeric,
  formula_quantidade text,
  formula_corte text,
  observacao text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planos_corte_produto_idx on public.planos_corte(produto_id);
create index if not exists planos_corte_status_idx on public.planos_corte(status);
create index if not exists plano_corte_componentes_plano_idx on public.plano_corte_componentes(plano_id);

-- Mantem o mesmo padrao temporario das tabelas operacionais atuais do Atlas:
-- RLS habilitado com policy permissiva. O endurecimento das policies deve ser
-- feito como projeto de seguranca separado, conforme DECISIONS.md.
alter table public.planos_corte enable row level security;
alter table public.plano_corte_componentes enable row level security;

drop policy if exists "acesso_total_temporario" on public.planos_corte;
create policy "acesso_total_temporario" on public.planos_corte
  for all using (true) with check (true);

drop policy if exists "acesso_total_temporario" on public.plano_corte_componentes;
create policy "acesso_total_temporario" on public.plano_corte_componentes
  for all using (true) with check (true);
