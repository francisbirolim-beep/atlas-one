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
comment on column public.produtos.codigo_origem is 'Codigo exatamente como veio da origem (W.Vetro ou outra). Nunca editar manualmente.';
comment on column public.produtos.origem is 'Origem do cadastro: wvetro | manual | atlas.';
comment on column public.produtos.id_externo_wvetro is 'Identificador/chave do produto no W.Vetro quando existir (ex.: ProdutoCodigo da API).';

-- 2) Dados especificos de perfil ---------------------------------------------
alter table public.produtos
  add column if not exists peso_kg_m numeric,
  add column if not exists tamanho_barra_mm numeric,
  add column if not exists tamanho_barra_mm_origem numeric;

comment on column public.produtos.peso_kg_m is 'Peso tecnico por metro linear (kg/m). Nao confundir com peso_kg (campo legado, mantido por compatibilidade).';
comment on column public.produtos.tamanho_barra_mm is 'Comprimento padrao da barra em mm, somente quando o valor de origem esta dentro de uma faixa plausivel (1000 a 8000 mm). Fora disso fica NULL e o valor cru soh existe em tamanho_barra_mm_origem, pendente de validacao humana.';
comment on column public.produtos.tamanho_barra_mm_origem is 'Valor cru de "Tamanho" como veio da planilha/API de origem, sem nenhuma correcao.';

-- marca ja existe e cumpre o papel de "fabricante" (Nome Fabricante do W.Vetro).
-- Nao foi criada coluna fabricante/codigo_fabricante/perda_percentual: nao ha
-- dado de origem distinto para elas nem necessidade concreta hoje (ver
-- docs/ai-handoff/DECISIONS.md).

-- 3) Preservacao do dado cru de origem ---------------------------------------
alter table public.produtos
  add column if not exists dados_origem jsonb;

comment on column public.produtos.dados_origem is 'Snapshot congelado dos valores tal como importados (codigo, descricao, peso, unidade, ncm, fabricante, tamanho). Nunca e sobrescrito automaticamente depois de gravado uma vez; serve para responder "o que veio do W.Vetro antes de alguem corrigir".';

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

comment on column public.produtos.status_validacao is 'importado (default, recem trazido de fonte externa) | revisado (alguem olhou) | validado (confiavel para uso automatico em receitas). Nada no Plano de Corte/Engenharia depende disso ainda -- e so a base.';

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

comment on column public.produtos.ncm_origem is 'NCM exatamente como veio da origem, preservado mesmo que seja placeholder (0, 12345678, etc).';
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
-- nulo) em vej de so um index normal.
create unique index if not exists uq_produtos_codigo_upper
  on public.produtos (upper(codigo))
  where codigo is not null;

create index if not exists idx_produtos_origem on public.produtos (origem);
create index if not exists idx_produtos_status_validacao on public.produtos (status_validacao);
create index if not exists idx_produtos_ncm_status on public.produtos (ncm_status);

-- 8) Backfill seguro (sem depender de lista externa de valores) --------------
-- codigo/codigo_origem/origem: hoje o codigo tecnico ja vive como prefixo de
-- produtos.nome no formato "CODIGO - DESCRICAO" para todo produto importado
-- do W.Vetro (perfil e acessorio). Extrai sem alterar nome/descricao.
update public.produtos
set
  codigo = trim(split_part(nome, ' - ', 1)),
  codigo_origem = trim(split_part(nome, ' - ', 1)),
  origem = 'wvetro'
where categoria in ('perfil', 'acessorio')
  and nome like '% - %'
  and codigo is null;

-- dados_origem: congela o snapshot dos valores importados como estao agora
-- (peso_kg, unidade, ncm, marca ja eram os valores crus trazidos do W.Vetro,
-- nunca editados manualmente ate esta migration). A partir daqui, correcoes
-- manuais em peso_kg/ncm/etc NAO alteram mais dados_origem.
update public.produtos
set dados_origem = jsonb_build_object(
  'codigo', trim(split_part(nome, ' - ', 1)),
  'descricao', trim(split_part(nome, ' - ', 2)),
  'peso', peso_kg,
  'unidade', unidade,
  'ncm', ncm,
  'fabricante', marca,
  'congelado_em', now()::date
)
where origem = 'wvetro'
  and dados_origem is null;

-- peso_kg_m: para perfil, o campo "Peso" do W.Vetro ja representa peso por
-- metro linear (valores tipicos entre 0.1 e 5 kg/m nos dados reais).
-- Copiado como esta -- nao e um calculo novo, e so nomear corretamente o que
-- ja estava em peso_kg.
update public.produtos
set peso_kg_m = peso_kg
where categoria = 'perfil'
  and peso_kg is not null
  and peso_kg_m is null;

-- ncm_origem: preserva o valor cru antes de qualquer eventual correcao futura.
update public.produtos
set ncm_origem = ncm
where origem = 'wvetro'
  and ncm_origem is null;

-- ncm_status: so marca 'invalido' quando o valor e inequivocamente placeholder.
-- Nunca marca 'valido' automaticamente (8 digitos numericos nao prova que o
-- NCM esta correto do ponto de vista fiscal) -- fica 'pendente' ate revisao
-- humana.
update public.produtos
set ncm_status = 'invalido'
where origem = 'wvetro'
  and (ncm is null or ncm in ('0', '', '12345678', '12345667'));

-- observacao_validacao: sinaliza os 2 casos de peso muito fora do padrao
-- encontrados na auditoria (SU 012 LATERAL LISA / SU 050 TRAVESSA CENTRAL),
-- sem alterar o valor numerico.
update public.produtos
set observacao_validacao = concat_ws(' ',
  observacao_validacao,
  'Peso de origem (' || peso_kg::text || ' kg) muito acima do padrao de perfil de aluminio (tipicamente 0.1-5 kg/m); possivel erro de digitacao no W.Vetro (ex.: peso total do lote em vez de peso por metro). Confirmar antes de usar em Engenharia/Plano de Corte.'
)
where categoria = 'perfil'
  and peso_kg is not null
  and peso_kg > 50
  and (observacao_validacao is null or observacao_validacao not like '%muito acima do padrao%');
