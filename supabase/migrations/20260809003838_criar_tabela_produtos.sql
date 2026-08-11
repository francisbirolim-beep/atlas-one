create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nome text not null,
  categoria text not null default 'outro',
  preco numeric not null default 0,
  unidade text not null default 'unidade',
  largura_mm numeric,
  altura_mm numeric,
  descricao text,
  ativo boolean not null default true,
  criado_por_id uuid,
  criado_por_nome text
);

alter table public.produtos enable row level security;

create policy "acesso_total_temporario" on public.produtos
  for all using (true) with check (true);;
