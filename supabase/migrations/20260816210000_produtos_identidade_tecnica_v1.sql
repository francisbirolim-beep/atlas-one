-- Identidade tecnica de Produto (perfis e acessorios W.Vetro) + preparacao para
-- receitas/plano de corte/estoque/compras tratarem o produto como biblioteca
-- tecnica confiavel.
--
-- Auditoria feita em 2026-08-16 antes desta migration (ver
-- docs/tecnico/auditoria-produtos-2026-08-16.md):
--   - 1700 produtos hoje (1307 perfil + 392 acessorio + 1 porta_janela_padrao).
--   - 0 codigos duplicados (case-insensitive) considerando o padrao atual
--     "CODIGO - DESCRICAO" em produtos.nome -> seguro criar unique index parcial.
--   - 279 produtos com NCM placeholder/vazio, 227 com NCM fora de 8 digitos.
--   - 2 produtos com peso_kg > 50 (fora do padrao de perfil de aluminio),
--     ainda sem uso em nenhuma receita/plano de corte.
--   - 0 produtos vinculados a linha_id/cor_id ainda.
--
-- Reconciliação posterior da base completa de acessórios (2026-08-16/17):
--   - 1174 acessórios na fonte W.Vetro x 392 acessórios atuais no Atlas;
--   - 389 códigos correspondentes;
--   - 93 divergências de unidade (fonte MT/PR/TB/BR/PT/PC x Atlas UN);
--   - a fonte possui também "Qtde Emb.", portanto unidade de origem/embalagem
--     não pode ser tratada automaticamente como unidade operacional de consumo.
--
-- Esta migration e' aditiva: nenhuma coluna existente e alterada/removida,
-- nenhuma linha e apagada. Todas as colunas novas sao opcionais (nullable)
-- ou tem default seguro.

begin;

-- 1) Identificacao tecnica ---------------------------------------------------
alter table public.produtos
  add column if not exists codigo text,
  add column if not exists codigo_origem text,
  add column if not exists origem text not null default 'manual',
  add column if not exists id_externo_wvetro text;

comment on column public.produtos.codigo is 'Codigo tecnico oficial usado no Atlas (ex.: SU010). Pode ser corrigido manualmente sem afetar codigo_origem.';
comment on column public.produtos.codigo_origem is 'Codigo exatamente como veio da origem quando essa origem for conhecida. Nunca editar manualmente.';
comment on column public.produtos.origem is 'Origem/proveniencia do cadastro. Valores usuais: wvetro | manual | atlas | legado. Legado significa registro preexistente cuja origem externa ainda nao foi reconciliada.';
comment on column public.produtos.id_externo_wvetro is 'Identificador/chave do produto no W.Vetro quando existir (ex.: ProdutoCodigo da API). Nao preencher com o codigo tecnico apenas para ocupar o campo.';

-- 2) Dados especificos de perfil e unidade de origem ------------------------
alter table public.produtos
  add column if not exists peso_kg_m numeric,
  add column if not exists tamanho_barra_mm numeric,
  add column if not exists tamanho_barra_mm_origem numeric,
  add column if not exists unidade_origem text,
  add column if not exists qtde_embalagem_origem numeric;

comment on column public.produtos.peso_kg_m is 'Peso tecnico por metro linear (kg/m). Nao confundir com peso_kg (campo legado, mantido por compatibilidade).';
comment on column public.produtos.tamanho_barra_mm is 'Comprimento padrao da barra em mm, somente quando o valor de origem esta dentro de uma faixa plausivel (1000 a 8000 mm). Fora disso fica NULL e o valor cru soh existe em tamanho_barra_mm_origem, pendente de validacao humana.';
comment on column public.produtos.tamanho_barra_mm_origem is 'Valor cru de "Tamanho" como veio da planilha/API de origem, sem nenhuma correcao.';
comment on column public.produtos.unidade_origem is 'Unidade exatamente como veio da fonte externa (ex.: UN, MT, PR, TB, BR, PT, PC). Nao substitui automaticamente produtos.unidade, que continua sendo a unidade operacional usada pelo Atlas/Engenharia.';
comment on column public.produtos.qtde_embalagem_origem is 'Valor cru de "Qtde Emb." da fonte externa. E dado de origem; nao interpretar automaticamente como fator de conversao ou unidade de consumo.';

-- marca ja existe e cumpre o papel de "fabricante" (Nome Fabricante do W.Vetro).
-- Nao foi criada coluna fabricante/codigo_fabricante/perda_percentual: nao ha
-- dado de origem distinto para elas nem necessidade concreta hoje (ver
-- docs/ai-handoff/DECISIONS.md).

-- 3) Preservacao do dado cru / snapshot legado -------------------------------
alter table public.produtos
  add column if not exists dados_origem jsonb;

comment on column public.produtos.dados_origem is 'Snapshot congelado da proveniencia disponivel. Para importacoes externas novas deve guardar os valores crus da fonte. Para registros preexistentes ainda nao reconciliados pode guardar somente um snapshot legado do estado Atlas, explicitamente identificado como tal; nunca fingir que esse snapshot e o dado cru do W.Vetro.';

-- 4) Status de validacao tecnica ---------------------------------------------
alter table public.produtos
  add column if not exists status_validacao text not null default 'importado',
  add column if not exists validado_em timestamptz,
  add column if not exists validado_por_id uuid,
  add column if not exists validado_por_nome text,
  add column if not exists observacao_validacao text;
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'produtos_status_validacao_check'
  ) then
    alter table public.produtos
      add constraint produtos_status_validacao_check
      check (status_validacao in ('importado', 'revisado', 'validado'));
  end if;
end $$;

comment on column public.produtos.status_validacao is 'importado (default, recem trazido de fonte externa ou ainda nao reconciliado) | revisado (alguem olhou) | validado (confiavel para uso automatico em receitas). Nada no Plano de Corte/Engenharia depende disso ainda -- e so a base.';

-- 5) NCM: sinalizacao sem correcao automatica --------------------------------
alter table public.produtos
  add column if not exists ncm_origem text,
  add column if not exists ncm_status text not null default 'pendente';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'produtos_ncm_status_check'
  ) then
    alter table public.produtos
      add constraint produtos_ncm_status_check
      check (ncm_status in ('pendente', 'valido', 'invalido'));
  end if;
end $$;

comment on column public.produtos.ncm_origem is 'NCM exatamente como veio da origem/proveniencia conhecida, preservado mesmo que seja placeholder (0, 12345678, etc).';
comment on column public.produtos.ncm_status is 'pendente (default) | valido | invalido. So marcado invalido quando o valor e claramente placeholder (0, vazio, sequencia generica). Nunca inventa nem corrige o numero do NCM.';

commit;

-- 6) Relacionamento N:N produto <-> linha ------------------------------------
-- produtos.linha_id (FK simples) e mantido por compatibilidade com o
-- formulario atual (app/cadastro/produtos/page.tsx) -- nao remover.
-- produto_linhas passa a ser a fonte para "um perfil pode pertencer a varias
-- linhas" (ex.: RPCS100 -> Suprema, Gold, ...). Nao populado automaticamente:
-- "GERAL" (visto na planilha de acessorios) e informacao de origem, nao
-- classificacao tecnica valida, entao nao deve virar vinculo aqui sem revisao
-- humana.
begin;

create table if not exists public.produto_linhas (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  linha_id uuid not null references public.linhas(id) on delete cascade,
  principal boolean not null default false,
  origem text,
  created_at timestamptz not null default now(),
  unique (produto_id, linha_id)
);

comment on table public.produto_linhas is 'Vinculo N:N entre produto e linha. Um perfil/acessorio pode pertencer a mais de uma linha. Nao popular a partir de valores de origem tipo "GERAL" sem revisao humana.';

create index if not exists idx_produto_linhas_produto on public.produto_linhas(produto_id);
create index if not exists idx_produto_linhas_linha on public.produto_linhas(linha_id);

alter table public.produto_linhas enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'produto_linhas' and policyname = 'produto_linhas_permissivo'
  ) then
    create policy produto_linhas_permissivo on public.produto_linhas
      for all using (true) with check (true);
  end if;
end $$;

commit;

-- 7) Indices de identificacao tecnica ----------------------------------------
-- Auditoria confirmou 0 duplicidade de codigo (case-insensitive) nos 1700
-- produtos atuais, inclusive sem colisao entre categorias diferentes.
-- Por isso e seguro criar unique index parcial (somente quando codigo nao e
-- nulo) em vez de so um index normal.
create unique index if not exists uq_produtos_codigo_upper
  on public.produtos (upper(codigo))
  where codigo is not null;

create index if not exists idx_produtos_origem on public.produtos (origem);
create index if not exists idx_produtos_status_validacao on public.produtos (status_validacao);
create index if not exists idx_produtos_ncm_status on public.produtos (ncm_status);

-- 8) Backfill seguro dos registros preexistentes -----------------------------
-- O codigo tecnico ja vive como prefixo de produtos.nome no formato
-- "CODIGO - DESCRICAO" para produtos tecnicos preexistentes. E seguro extrair
-- o codigo operacional, mas NAO e seguro concluir apenas pelo formato do nome
-- que todo registro veio da base completa W.Vetro: a reconciliacao de
-- acessorios encontrou 3 codigos existentes somente no Atlas.
--
-- Por isso:
--   - codigo e extraido para uso interno;
--   - codigo_origem preserva o codigo legado conhecido;
--   - origem fica "legado" ate uma reconciliacao confirmar a fonte externa;
--   - unidade_origem / qtde_embalagem_origem NAO recebem backfill da coluna
--     unidade atual, pois 93 acessorios provaram que esse valor pode ser um
--     placeholder historico (UN) e nao a unidade real da fonte.
update public.produtos
set
  codigo = trim(split_part(nome, ' - ', 1)),
  codigo_origem = trim(split_part(nome, ' - ', 1)),
  origem = 'legado'
where categoria in ('perfil', 'acessorio')
  and nome like '% - %'
  and codigo is null;

-- dados_origem: para os registros preexistentes, congela explicitamente o
-- estado legado do Atlas antes da reconciliacao. Nao rotula unidade/ncm/peso
-- atuais como "valor cru W.Vetro". A futura carga reconciliada pode enriquecer
-- a proveniencia com os valores reais da fonte sem sobrescrita silenciosa.
update public.produtos
set dados_origem = jsonb_build_object(
  'snapshot_tipo', 'atlas_legacy_pre_reconciliacao',
  'codigo_legado', trim(split_part(nome, ' - ', 1)),
  'descricao_legada', trim(split_part(nome, ' - ', 2)),
  'peso_kg_atlas', peso_kg,
  'unidade_atlas', unidade,
  'ncm_atlas', ncm,
  'marca_atlas', marca,
  'congelado_em', now()::date
)
where origem = 'legado'
  and dados_origem is null;

-- peso_kg_m: para perfil, nomeia o valor tecnico ja existente como kg/m.
-- Os casos fora da faixa plausivel permanecem sinalizados para revisao e
-- nenhum valor e alterado/zerado automaticamente.
update public.produtos
set peso_kg_m = peso_kg
where categoria = 'perfil'
  and peso_kg is not null
  and peso_kg_m is null;

-- ncm_origem: preserva o NCM legado existente como parte da proveniencia
-- conhecida, sem afirmar que ele veio diretamente da base completa W.Vetro.
update public.produtos
set ncm_origem = ncm
where origem = 'legado'
  and ncm_origem is null;

-- ncm_status: so marca 'invalido' quando o valor e inequivocamente placeholder.
-- Nunca marca 'valido' automaticamente (8 digitos numericos nao prova que o
-- NCM esta correto do ponto de vista fiscal) -- fica 'pendente' ate revisao
-- humana.
update public.produtos
set ncm_status = 'invalido'
where origem = 'legado'
  and (ncm is null or ncm in ('0', '', '12345678', '12345667'));

-- observacao_validacao: sinaliza os 2 casos de peso muito fora do padrao
-- encontrados na auditoria (SU 012 LATERAL LISA / SU 050 TRAVESSA CENTRAL),
-- sem alterar o valor numerico.
update public.produtos
set observacao_validacao = concat_ws(' ',
  observacao_validacao,
  'Peso de origem/legado (' || peso_kg::text || ' kg) muito acima do padrao de perfil de aluminio (tipicamente 0.1-5 kg/m); confirmar a unidade/origem antes de usar em Engenharia/Plano de Corte.'
)
where categoria = 'perfil'
  and peso_kg is not null
  and peso_kg > 50
  and (observacao_validacao is null or observacao_validacao not like '%muito acima do padrao%');