-- Chaves estáveis para upsert do staging e snapshot bruto do catálogo da API W.Vetro.

alter table public.wvetro_referencias_tipologias add column if not exists chave text;
update public.wvetro_referencias_tipologias
set chave = md5(lower(btrim(linha_raw)) || '::' || lower(btrim(modelo_raw)))
where chave is null;
alter table public.wvetro_referencias_tipologias alter column chave set not null;
create unique index if not exists uq_wvetro_referencias_tipologias_chave on public.wvetro_referencias_tipologias(chave);

alter table public.wvetro_referencias_componentes add column if not exists chave text;
update public.wvetro_referencias_componentes
set chave = md5(
  tipo || '::' || coalesce(codigo,'') || '::' || coalesce(codigo_wvetro,'') || '::' ||
  lower(btrim(nome)) || '::' || lower(btrim(coalesce(cor,'')))
)
where chave is null;
alter table public.wvetro_referencias_componentes alter column chave set not null;
create unique index if not exists uq_wvetro_referencias_componentes_chave on public.wvetro_referencias_componentes(chave);

alter table public.wvetro_referencias_vidros add column if not exists chave text;
update public.wvetro_referencias_vidros
set chave = md5(coalesce(codigo,'') || '::' || lower(btrim(especificacao)))
where chave is null;
alter table public.wvetro_referencias_vidros alter column chave set not null;
create unique index if not exists uq_wvetro_referencias_vidros_chave on public.wvetro_referencias_vidros(chave);

create table if not exists public.wvetro_produtos_snapshot (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  codigo text not null,
  produto_atlas_id uuid references public.produtos(id) on delete set null,
  produto_wvetro_id text,
  seu_codigo text,
  descricao text,
  ativo boolean,
  linha_id_wvetro text,
  linha_nome_wvetro text,
  especie_id text,
  especie_nome text,
  tipo_id text,
  tipo_nome text,
  unidade text,
  ncm text,
  url_origem text,
  payload jsonb not null default '{}'::jsonb,
  consultado_em timestamptz not null default now(),
  erro text,
  constraint wvetro_produtos_snapshot_tipo_check check (tipo in ('P','A','E')),
  unique (tipo,codigo)
);

alter table public.wvetro_produtos_snapshot enable row level security;
revoke all on public.wvetro_produtos_snapshot from anon, authenticated;
grant all on public.wvetro_produtos_snapshot to service_role;
