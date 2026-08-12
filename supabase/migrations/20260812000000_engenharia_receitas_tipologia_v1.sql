-- Engenharia Fase 5: base persistente de receitas tecnicas por tipologia.
-- Nesta fase as formulas sao apenas armazenadas; nenhum calculo automatico e executado.

create table if not exists public.engenharia_receitas (
  id uuid primary key default gen_random_uuid(),
  tipologia_id uuid not null references public.tipologias(id) on delete cascade,
  nome text not null,
  versao integer not null default 1 check (versao > 0),
  ativo boolean not null default true,
  observacoes text,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists engenharia_receitas_tipologia_ativa_uidx
  on public.engenharia_receitas(tipologia_id)
  where ativo = true;

create index if not exists engenharia_receitas_tipologia_idx
  on public.engenharia_receitas(tipologia_id, versao desc);

create table if not exists public.engenharia_receita_componentes (
  id uuid primary key default gen_random_uuid(),
  receita_id uuid not null references public.engenharia_receitas(id) on delete cascade,
  tipo text not null check (tipo in ('perfil','acessorio','vidro','reforco','outro')),
  produto_id uuid references public.produtos(id) on delete set null,
  nome text not null,
  unidade text not null default 'un',
  quantidade_base numeric(14,4) not null default 1,
  formula_quantidade text,
  formula_corte text,
  observacao text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists engenharia_receita_componentes_receita_idx
  on public.engenharia_receita_componentes(receita_id, ordem, created_at);

create or replace function public.fn_engenharia_receita_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_engenharia_receitas_touch on public.engenharia_receitas;
create trigger trg_engenharia_receitas_touch
before update on public.engenharia_receitas
for each row execute function public.fn_engenharia_receita_touch();

drop trigger if exists trg_engenharia_receita_componentes_touch on public.engenharia_receita_componentes;
create trigger trg_engenharia_receita_componentes_touch
before update on public.engenharia_receita_componentes
for each row execute function public.fn_engenharia_receita_touch();
