create table if not exists linhas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  nome text not null,
  fabricante text,
  descricao text,
  apelidos text[] not null default '{}',
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists linha_produtos (
  linha_id uuid not null references linhas_tecnicas(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (linha_id, produto_id)
);

create table if not exists linha_tipologias (
  linha_id uuid not null references linhas_tecnicas(id) on delete cascade,
  tipologia_id uuid not null references tipologias(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (linha_id, tipologia_id)
);

alter table linhas_tecnicas enable row level security;
alter table linha_produtos enable row level security;
alter table linha_tipologias enable row level security;

create policy "acesso_total_temporario" on linhas_tecnicas for all using (true) with check (true);
create policy "acesso_total_temporario" on linha_produtos for all using (true) with check (true);
create policy "acesso_total_temporario" on linha_tipologias for all using (true) with check (true);

insert into linhas_tecnicas (chave, nome, apelidos, ordem) values
  ('suprema', 'SUPREMA', array['L. SUPREMA','LINHA SUPREMA'], 1),
  ('gold', 'GOLD', array['L. GOLD','LINHA GOLD'], 2),
  ('linha_30', 'LINHA 30', array['L. 30','LINHA 30'], 3),
  ('pele_de_vidro_atlanta', 'PELE DE VIDRO / FACHADA ATLANTA', array['PELE DE VIDRO','FACHADA ATLANTA','ATLANTA'], 4),
  ('revestimento_ripado', 'REVESTIMENTO RIPADO', array['RIPADO','REVESTIMENTO RIPADO'], 5)
on conflict (chave) do nothing;
