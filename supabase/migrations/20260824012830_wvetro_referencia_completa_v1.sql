-- Atlas One — referência completa W.Vetro
-- Preserva a origem bruta e nunca substitui automaticamente receitas/fórmulas validadas do Atlas.

alter table public.linhas_tecnicas
  add column if not exists origem_referencia text not null default 'atlas',
  add column if not exists linha_wvetro_raw text,
  add column if not exists status_validacao text not null default 'em_validacao';

alter table public.linhas_tecnicas
  drop constraint if exists linhas_tecnicas_origem_referencia_check;
alter table public.linhas_tecnicas
  add constraint linhas_tecnicas_origem_referencia_check
  check (origem_referencia in ('atlas','wvetro','misto'));

alter table public.linhas_tecnicas
  drop constraint if exists linhas_tecnicas_status_validacao_check;
alter table public.linhas_tecnicas
  add constraint linhas_tecnicas_status_validacao_check
  check (status_validacao in ('referencia_wvetro','em_validacao','validada'));

alter table public.tipologias
  add column if not exists origem_referencia text not null default 'atlas',
  add column if not exists linha_origem_wvetro text,
  add column if not exists modelo_origem_wvetro text,
  add column if not exists foto_url text,
  add column if not exists wvetro_primeiro_visto date,
  add column if not exists wvetro_ultimo_visto date,
  add column if not exists wvetro_ocorrencias integer;

alter table public.tipologias
  drop constraint if exists tipologias_origem_referencia_check;
alter table public.tipologias
  add constraint tipologias_origem_referencia_check
  check (origem_referencia in ('atlas','wvetro','misto'));

create table if not exists public.wvetro_referencias_linhas (
  id uuid primary key default gen_random_uuid(),
  linha_raw text not null unique,
  origem_tipologias boolean not null default false,
  origem_acessorios boolean not null default false,
  origem_api_linhas boolean not null default false,
  qtd_tipologias integer not null default 0,
  qtd_acessorios integer not null default 0,
  linha_tecnica_id uuid references public.linhas_tecnicas(id) on delete set null,
  status_mapeamento text not null default 'referencia',
  dados_origem jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wvetro_referencias_linhas_status_check
    check (status_mapeamento in ('referencia','mapeada_exata','pendente_revisao'))
);

create table if not exists public.wvetro_referencias_vidros (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  especificacao text not null,
  ncm text,
  tipo_fixacao text,
  imagem_url text,
  primeiro_visto date,
  ultimo_visto date,
  ocorrencias integer not null default 0,
  produto_atlas_id uuid references public.produtos(id) on delete set null,
  status_validacao text not null default 'referencia_wvetro',
  dados_origem jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wvetro_referencias_vidros_status_check
    check (status_validacao in ('referencia_wvetro','em_validacao','validado_atlas'))
);

create unique index if not exists uq_wvetro_referencias_vidros_codigo_especificacao
  on public.wvetro_referencias_vidros (coalesce(codigo,''), especificacao);

create table if not exists public.wvetro_auditoria_execucoes (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'iniciada',
  periodo_inicio date,
  periodo_fim date,
  cursor_data date,
  cursor_produto integer not null default 0,
  totais jsonb not null default '{}'::jsonb,
  observacoes jsonb not null default '[]'::jsonb,
  erro text,
  iniciado_por_id uuid,
  iniciado_por_nome text,
  created_at timestamptz not null default now(),
  finalizado_em timestamptz,
  constraint wvetro_auditoria_execucoes_status_check
    check (status in ('iniciada','em_execucao','concluida','erro'))
);

-- As 109 tipologias criadas neste lote foram documentadas como resultado da extração
-- histórica de 1.038 vendas/orçamentos W.Vetro. Formaliza a proveniência sem alterar label/chave.
update public.tipologias
set origem_referencia = 'wvetro',
    linha_origem_wvetro = substring(label from '\(([^()]*)\)\s*$'),
    modelo_origem_wvetro = regexp_replace(label, '\s*\([^()]*\)\s*$', ''),
    wvetro_primeiro_visto = coalesce(wvetro_primeiro_visto, created_at::date),
    wvetro_ultimo_visto = coalesce(wvetro_ultimo_visto, created_at::date)
where created_at = '2026-08-16 12:35:26.738574+00'::timestamptz
  and substring(label from '\(([^()]*)\)\s*$') is not null;

-- Referências de Linha encontradas nas tipologias W.Vetro.
insert into public.wvetro_referencias_linhas (
  linha_raw, origem_tipologias, qtd_tipologias, dados_origem
)
select linha_origem_wvetro,
       true,
       count(*),
       jsonb_build_object('fonte','tipologias_historicas_wvetro','metodo','Linha + Modelo')
from public.tipologias
where origem_referencia = 'wvetro'
  and linha_origem_wvetro is not null
  and btrim(linha_origem_wvetro) <> ''
group by linha_origem_wvetro
on conflict (linha_raw) do update
set origem_tipologias = true,
    qtd_tipologias = excluded.qtd_tipologias,
    updated_at = now();

-- Referências de Linha preservadas no ExportWWAcessorios.
insert into public.wvetro_referencias_linhas (
  linha_raw, origem_acessorios, qtd_acessorios, dados_origem
)
select dados_origem->>'linha_raw',
       true,
       count(*),
       jsonb_build_object('fonte','ExportWWAcessorios.xlsx','campo','Linha')
from public.produtos
where categoria = 'acessorio'
  and origem = 'wvetro'
  and nullif(btrim(dados_origem->>'linha_raw'),'') is not null
group by dados_origem->>'linha_raw'
on conflict (linha_raw) do update
set origem_acessorios = true,
    qtd_acessorios = excluded.qtd_acessorios,
    updated_at = now();

-- Primeiro associa referências a linhas Atlas já existentes por igualdade exata
-- de nome/apelido. Nunca usa LIKE/fuzzy/similaridade.
update public.wvetro_referencias_linhas r
set linha_tecnica_id = l.id,
    status_mapeamento = 'mapeada_exata',
    updated_at = now()
from public.linhas_tecnicas l
where lower(btrim(r.linha_raw)) = lower(btrim(l.nome))
   or exists (
     select 1 from unnest(l.apelidos) a
     where lower(btrim(a)) = lower(btrim(r.linha_raw))
   );

-- Uma referência W.Vetro exata em linha já existente passa a ter origem mista.
update public.linhas_tecnicas l
set origem_referencia = case when l.origem_referencia = 'wvetro' then 'wvetro' else 'misto' end,
    linha_wvetro_raw = coalesce(l.linha_wvetro_raw, r.linha_raw),
    updated_at = now()
from public.wvetro_referencias_linhas r
where r.linha_tecnica_id = l.id
  and r.origem_tipologias;

-- Para Linha que realmente aparece em tipologia W.Vetro e ainda não existe no Atlas,
-- cria uma linha técnica com o nome BRUTO/EXATO da origem. Ela entra no seletor para
-- permitir continuar o tratamento, mas nasce claramente como referência não validada.
insert into public.linhas_tecnicas (
  chave, nome, descricao, apelidos, ativo, ordem,
  origem_referencia, linha_wvetro_raw, status_validacao
)
select 'wvetro_' || substr(md5(lower(btrim(r.linha_raw))),1,16),
       r.linha_raw,
       'Importada como referência exata do W.Vetro. Pendente de validação técnica no Atlas.',
       '{}'::text[],
       true,
       900 + row_number() over (order by r.linha_raw),
       'wvetro',
       r.linha_raw,
       'referencia_wvetro'
from public.wvetro_referencias_linhas r
where r.origem_tipologias
  and r.linha_tecnica_id is null
on conflict (chave) do nothing;

-- Linhas que só aparecem em acessórios também são preservadas no Atlas,
-- mas ficam inativas para não poluir o seletor de orçamento sem tipologia associada.
insert into public.linhas_tecnicas (
  chave, nome, descricao, apelidos, ativo, ordem,
  origem_referencia, linha_wvetro_raw, status_validacao
)
select 'wvetro_' || substr(md5(lower(btrim(r.linha_raw))),1,16),
       r.linha_raw,
       'Linha preservada a partir do cadastro de acessórios W.Vetro. Sem tipologia histórica vinculada; pendente validação.',
       '{}'::text[],
       false,
       1200 + row_number() over (order by r.linha_raw),
       'wvetro',
       r.linha_raw,
       'referencia_wvetro'
from public.wvetro_referencias_linhas r
where not r.origem_tipologias
  and r.origem_acessorios
  and r.linha_tecnica_id is null
on conflict (chave) do nothing;

-- Atualiza o mapa após criar as linhas ausentes.
update public.wvetro_referencias_linhas r
set linha_tecnica_id = l.id,
    status_mapeamento = 'mapeada_exata',
    updated_at = now()
from public.linhas_tecnicas l
where r.linha_tecnica_id is null
  and l.origem_referencia = 'wvetro'
  and l.linha_wvetro_raw = r.linha_raw;

-- Liga TODAS as tipologias históricas W.Vetro à sua Linha de origem exata.
insert into public.linha_tipologias (linha_id, tipologia_id)
select r.linha_tecnica_id, t.id
from public.tipologias t
join public.wvetro_referencias_linhas r
  on r.linha_raw = t.linha_origem_wvetro
where t.origem_referencia = 'wvetro'
  and r.linha_tecnica_id is not null
on conflict do nothing;

-- Pós-checks: a carga histórica conhecida precisa continuar íntegra.
do $$
declare
  v_tipologias integer;
  v_vinculadas integer;
  v_perfis integer;
  v_acessorios_wvetro integer;
begin
  select count(*) into v_tipologias
  from public.tipologias where origem_referencia = 'wvetro';

  select count(*) into v_vinculadas
  from public.tipologias t
  where t.origem_referencia='wvetro'
    and exists (select 1 from public.linha_tipologias lt where lt.tipologia_id=t.id);

  select count(*) into v_perfis
  from public.produtos where categoria='perfil' and origem='wvetro';

  select count(*) into v_acessorios_wvetro
  from public.produtos where categoria='acessorio' and origem='wvetro';

  if v_tipologias < 109 then
    raise exception 'Auditoria W.Vetro: esperado >=109 tipologias históricas, encontrado %', v_tipologias;
  end if;
  if v_vinculadas <> v_tipologias then
    raise exception 'Auditoria W.Vetro: % tipologias W.Vetro ainda sem linha (total %)', v_tipologias-v_vinculadas, v_tipologias;
  end if;
  if v_perfis <> 1307 then
    raise exception 'Auditoria W.Vetro: catálogo de perfis divergente, esperado 1307, encontrado %', v_perfis;
  end if;
  if v_acessorios_wvetro <> 1174 then
    raise exception 'Auditoria W.Vetro: catálogo de acessórios divergente, esperado 1174, encontrado %', v_acessorios_wvetro;
  end if;
end $$;

alter table public.wvetro_referencias_linhas enable row level security;
alter table public.wvetro_referencias_vidros enable row level security;
alter table public.wvetro_auditoria_execucoes enable row level security;

revoke all on public.wvetro_referencias_linhas from anon, authenticated;
revoke all on public.wvetro_referencias_vidros from anon, authenticated;
revoke all on public.wvetro_auditoria_execucoes from anon, authenticated;
grant all on public.wvetro_referencias_linhas to service_role;
grant all on public.wvetro_referencias_vidros to service_role;
grant all on public.wvetro_auditoria_execucoes to service_role;
