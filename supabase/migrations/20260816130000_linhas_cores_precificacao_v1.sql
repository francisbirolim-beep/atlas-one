-- Linhas, cores e configuracoes de precificacao (materiais)
-- Base para cadastro de Linha de produto, Cor (com peso por metro) e
-- preco do Kg do aluminio, usados no calculo de custo de perfis.

create table if not exists linhas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cores (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  peso_kg_metro numeric,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists configuracoes_precificacao (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  valor numeric,
  updated_at timestamptz not null default now()
);

alter table produtos add column if not exists linha_id uuid references linhas(id);
alter table produtos add column if not exists cor_id uuid references cores(id);

alter table linhas enable row level security;
alter table cores enable row level security;
alter table configuracoes_precificacao enable row level security;

drop policy if exists "acesso_total_temporario" on linhas;
create policy "acesso_total_temporario" on linhas for all using (true) with check (true);

drop policy if exists "acesso_total_temporario" on cores;
create policy "acesso_total_temporario" on cores for all using (true) with check (true);

drop policy if exists "acesso_total_temporario" on configuracoes_precificacao;
create policy "acesso_total_temporario" on configuracoes_precificacao for all using (true) with check (true);

insert into configuracoes_precificacao (chave, valor)
values ('preco_kg_aluminio', 0)
on conflict (chave) do nothing;
