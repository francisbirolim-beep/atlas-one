
create table if not exists tipologias (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  label text not null,
  categoria text not null default 'janela' check (categoria in ('porta','janela')),
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

alter table tipologias enable row level security;
create policy "acesso_total_temporario" on tipologias for all using (true) with check (true);

insert into tipologias (chave, label, categoria, ordem) values
  ('porta_correr', 'Porta de Correr', 'porta', 1),
  ('porta_pivotante', 'Porta Pivotante', 'porta', 2),
  ('porta_abrir', 'Porta de Abrir', 'porta', 3),
  ('janela_correr', 'Janela de Correr', 'janela', 4),
  ('janela_maximiar', 'Janela Maxim-Ar', 'janela', 5),
  ('janela_basculante', 'Janela Basculante', 'janela', 6),
  ('vitro', 'Vitrô', 'janela', 7),
  ('fachada', 'Fachada', 'janela', 8),
  ('box', 'Box', 'janela', 9),
  ('outro', 'Outro', 'janela', 10)
on conflict (chave) do nothing;
;
