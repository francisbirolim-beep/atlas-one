-- Staging auditável do W.Vetro.
-- Guarda tudo que a API/histórico encontrar sem obrigar promoção automática ao cadastro oficial.

create table if not exists public.wvetro_referencias_tipologias (
  id uuid primary key default gen_random_uuid(),
  linha_raw text not null,
  modelo_raw text not null,
  tipologia_atlas_id uuid references public.tipologias(id) on delete set null,
  imagem_url text,
  primeiro_visto date,
  ultimo_visto date,
  ocorrencias integer not null default 0,
  status_mapeamento text not null default 'referencia',
  dados_origem jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wvetro_referencias_tipologias_status_check
    check (status_mapeamento in ('referencia','mapeada_exata','pendente_revisao'))
);

create unique index if not exists uq_wvetro_referencias_tipologias_linha_modelo
  on public.wvetro_referencias_tipologias (lower(btrim(linha_raw)), lower(btrim(modelo_raw)));

create table if not exists public.wvetro_referencias_componentes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  codigo text,
  codigo_wvetro text,
  nome text not null,
  cor text,
  ncm text,
  imagem_url text,
  ocorrencias integer not null default 0,
  custo_min numeric,
  custo_max numeric,
  venda_min numeric,
  venda_max numeric,
  primeiro_visto date,
  ultimo_visto date,
  produto_atlas_id uuid references public.produtos(id) on delete set null,
  status_mapeamento text not null default 'referencia',
  dados_origem jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wvetro_referencias_componentes_tipo_check
    check (tipo in ('perfil','acessorio')),
  constraint wvetro_referencias_componentes_status_check
    check (status_mapeamento in ('referencia','mapeada_exata','pendente_revisao'))
);

create unique index if not exists uq_wvetro_referencias_componentes_identidade
  on public.wvetro_referencias_componentes (
    tipo,
    coalesce(codigo,''),
    coalesce(codigo_wvetro,''),
    lower(btrim(nome)),
    lower(btrim(coalesce(cor,'')))
  );

-- Semeia o staging com as 109 tipologias históricas já documentadas como W.Vetro.
insert into public.wvetro_referencias_tipologias (
  linha_raw, modelo_raw, tipologia_atlas_id, primeiro_visto, ultimo_visto,
  status_mapeamento, dados_origem
)
select t.linha_origem_wvetro,
       t.modelo_origem_wvetro,
       t.id,
       t.wvetro_primeiro_visto,
       t.wvetro_ultimo_visto,
       'mapeada_exata',
       jsonb_build_object('fonte','extracao_historica_1038_vendas_orcamentos')
from public.tipologias t
where t.origem_referencia='wvetro'
  and t.linha_origem_wvetro is not null
  and t.modelo_origem_wvetro is not null
on conflict do nothing;

alter table public.wvetro_referencias_tipologias enable row level security;
alter table public.wvetro_referencias_componentes enable row level security;

revoke all on public.wvetro_referencias_tipologias from anon, authenticated;
revoke all on public.wvetro_referencias_componentes from anon, authenticated;
grant all on public.wvetro_referencias_tipologias to service_role;
grant all on public.wvetro_referencias_componentes to service_role;
