-- Engenharia: variaveis declarativas por tipologia + variantes condicionais
-- de componentes da receita + presets fixos salvaveis.
--
-- Objetivo: o fluxo Linha -> Tipologia -> Variaveis vira selecao estruturada
-- (nao texto livre), e a combinacao de variaveis escolhidas pode substituir
-- produto/formula de um componente da receita por uma variante especifica.
-- Sem eval, sem logica opaca em string (ver docs/ai-handoff/DECISIONS.md).

create table if not exists public.engenharia_variaveis (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  label text not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.engenharia_variavel_opcoes (
  id uuid primary key default gen_random_uuid(),
  variavel_id uuid not null references public.engenharia_variaveis(id) on delete cascade,
  chave text not null,
  label text not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  unique (variavel_id, chave)
);

create table if not exists public.engenharia_tipologia_variaveis (
  id uuid primary key default gen_random_uuid(),
  tipologia_id uuid not null references public.tipologias(id) on delete cascade,
  variavel_id uuid not null references public.engenharia_variaveis(id) on delete cascade,
  ordem integer not null default 0,
  obrigatorio boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tipologia_id, variavel_id)
);

create table if not exists public.engenharia_componente_variantes (
  id uuid primary key default gen_random_uuid(),
  componente_id uuid not null references public.engenharia_receita_componentes(id) on delete cascade,
  condicoes jsonb not null default '{}'::jsonb,
  produto_id uuid references public.produtos(id) on delete set null,
  nome text,
  quantidade_base numeric(14,4),
  formula_quantidade text,
  formula_corte text,
  observacao text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists engenharia_componente_variantes_componente_idx
  on public.engenharia_componente_variantes(componente_id, ativo, ordem);

create table if not exists public.engenharia_variaveis_preset (
  id uuid primary key default gen_random_uuid(),
  tipologia_id uuid not null references public.tipologias(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete cascade,
  nome text not null,
  valores jsonb not null default '{}'::jsonb,
  padrao boolean not null default false,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists engenharia_variaveis_preset_tipologia_idx
  on public.engenharia_variaveis_preset(tipologia_id, produto_id);

-- RLS: mesmo padrao permissivo temporario ja usado no projeto (ver DECISIONS.md).
alter table public.engenharia_variaveis enable row level security;
alter table public.engenharia_variavel_opcoes enable row level security;
alter table public.engenharia_tipologia_variaveis enable row level security;
alter table public.engenharia_componente_variantes enable row level security;
alter table public.engenharia_variaveis_preset enable row level security;

drop policy if exists "acesso_total_temporario" on public.engenharia_variaveis;
create policy "acesso_total_temporario" on public.engenharia_variaveis for all using (true) with check (true);

drop policy if exists "acesso_total_temporario" on public.engenharia_variavel_opcoes;
create policy "acesso_total_temporario" on public.engenharia_variavel_opcoes for all using (true) with check (true);

drop policy if exists "acesso_total_temporario" on public.engenharia_tipologia_variaveis;
create policy "acesso_total_temporario" on public.engenharia_tipologia_variaveis for all using (true) with check (true);

drop policy if exists "acesso_total_temporario" on public.engenharia_componente_variantes;
create policy "acesso_total_temporario" on public.engenharia_componente_variantes for all using (true) with check (true);

drop policy if exists "acesso_total_temporario" on public.engenharia_variaveis_preset;
create policy "acesso_total_temporario" on public.engenharia_variaveis_preset for all using (true) with check (true);

-- Seed: mesmas chaves que ja existiam como texto livre em planos_corte.variaveis,
-- agora como catalogo estruturado com opcoes. Master pode editar/adicionar
-- variaveis, opcoes e vinculos pela tela Engenharia > Receitas tecnicas.
insert into public.engenharia_variaveis (chave, label, ordem) values
  ('montagem', 'Montagem', 1),
  ('trilho', 'Trilho', 2),
  ('contramarco', 'Contramarco', 3),
  ('arremate', 'Arremate', 4),
  ('fechadura', 'Fechadura', 5),
  ('puxador', 'Puxador', 6),
  ('mao_amiga', 'Mão de amigo', 7),
  ('reforco', 'Reforço', 8),
  ('roldana', 'Roldana', 9),
  ('folhas', 'Número de folhas', 10)
on conflict (chave) do nothing;

insert into public.engenharia_variavel_opcoes (variavel_id, chave, label, ordem)
select v.id, o.chave, o.label, o.ordem
from public.engenharia_variaveis v
join (values
  ('montagem', 'todas_moveis', 'Todas móveis', 1),
  ('montagem', 'fixa_movel', 'Fixa + móvel', 2),
  ('trilho', 'embutir', 'Trilho de embutir', 1),
  ('trilho', 'convencional', 'Trilho convencional', 2),
  ('contramarco', 'sim', 'Com contramarco', 1),
  ('contramarco', 'nao', 'Sem contramarco', 2),
  ('arremate', 'face_interna', 'Arremate face interna', 1),
  ('arremate', 'sem', 'Sem arremate', 2),
  ('fechadura', 'sim', 'Com fechadura (fecha duro)', 1),
  ('fechadura', 'nao', 'Sem fechadura (com folga)', 2),
  ('puxador', 'sim', 'Com puxador', 1),
  ('puxador', 'nao', 'Sem puxador', 2),
  ('mao_amiga', 'comum', 'Comum', 1),
  ('mao_amiga', 'largo', 'Largo', 2),
  ('reforco', 'interno', 'Reforço interno', 1),
  ('reforco', 'externo', 'Reforço externo', 2),
  ('reforco', 'sem', 'Sem reforço', 3),
  ('roldana', '100kg', 'Roldana até 100 kg', 1),
  ('roldana', '200kg', 'Roldana dupla 200 kg', 2),
  ('folhas', '2', '2 folhas', 1),
  ('folhas', '3', '3 folhas', 2),
  ('folhas', '4', '4 folhas', 3)
) as o(variavel_chave, chave, label, ordem) on o.variavel_chave = v.chave
on conflict (variavel_id, chave) do nothing;
