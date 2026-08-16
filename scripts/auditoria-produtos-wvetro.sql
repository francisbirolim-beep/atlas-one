-- Auditoria de dados importados em public.produtos (perfis e acessorios
-- W.Vetro). Somente leitura -- nunca corrige nada automaticamente.
-- Rodar de novo depois de qualquer nova importacao (ex.: ExportWWAcessorios).
--
-- Classificacao por produto:
--   REVISAR  -> codigo duplicado, sem codigo, NCM placeholder ou peso fora
--               de faixa plausivel (perfil de aluminio).
--   ATENCAO  -> NCM com tamanho diferente de 8 digitos mas nao placeholder,
--               ou tamanho de barra fora da faixa plausivel (perfil).
--   OK       -> nenhum dos problemas acima.
--
-- "Sem vinculo de linha" e reportado a parte (bloco 2) porque hoje 100% dos
-- produtos estao sem linha_id/produto_linhas -- isso ainda nao e uma
-- inconsistencia de dado, e trabalho de cadastro pendente.

-- Bloco 1: classificacao OK / ATENCAO / REVISAR -----------------------------
with base as (
  select
    id, categoria, nome, unidade, ncm, peso_kg, marca,
    coalesce(codigo, trim(split_part(nome, ' - ', 1))) as codigo_calc
  from public.produtos
),
dups as (
  select upper(codigo_calc) as codigo_up
  from base
  where codigo_calc is not null and codigo_calc <> ''
  group by 1
  having count(*) > 1
)
select
  b.id, b.categoria, b.codigo_calc, b.nome, b.ncm, b.peso_kg,
  case
    when b.codigo_calc is null or b.codigo_calc = '' then 'REVISAR'
    when upper(b.codigo_calc) in (select codigo_up from dups) then 'REVISAR'
    when b.ncm is null or b.ncm in ('0', '', '12345678', '12345667') then 'REVISAR'
    when b.categoria = 'perfil' and b.peso_kg is not null and (b.peso_kg > 50 or b.peso_kg <= 0) then 'REVISAR'
    when b.ncm is not null and length(regexp_replace(b.ncm, '[^0-9]', '', 'g')) <> 8 then 'ATENCAO'
    else 'OK'
  end as classificacao
from base b
order by classificacao desc, b.categoria, b.codigo_calc;

-- Bloco 2: resumo numerico ----------------------------------------------------
with base as (
  select
    id, categoria, unidade, ncm, peso_kg, linha_id, cor_id,
    coalesce(codigo, trim(split_part(nome, ' - ', 1))) as codigo_calc
  from public.produtos
),
dups as (
  select upper(codigo_calc) as codigo_up
  from base
  where codigo_calc is not null and codigo_calc <> ''
  group by 1
  having count(*) > 1
)
select
  count(*) as total_produtos,
  count(*) filter (where categoria = 'perfil') as total_perfil,
  count(*) filter (where categoria = 'acessorio') as total_acessorio,
  count(*) filter (where codigo_calc is null or codigo_calc = '') as sem_codigo,
  (select count(*) from dups) as codigos_duplicados,
  count(*) filter (where unidade is null or unidade = '') as sem_unidade,
  count(*) filter (where ncm is null or ncm in ('0','','12345678','12345667')) as ncm_placeholder,
  count(*) filter (where ncm is not null and length(regexp_replace(ncm,'[^0-9]','','g')) <> 8) as ncm_tamanho_errado,
  count(*) filter (where categoria = 'perfil' and peso_kg is not null and peso_kg > 50) as peso_perfil_suspeito_alto,
  count(*) filter (where categoria = 'perfil' and peso_kg is not null and peso_kg <= 0) as peso_perfil_zero_ou_negativo,
  count(*) filter (where linha_id is null) as sem_linha_vinculada,
  count(*) filter (where cor_id is null) as sem_cor_vinculada
from base;

-- Bloco 3: linhas com nome "GERAL" (nao deve virar vinculo tecnico definitivo) -
select id, nome from public.linhas where upper(nome) = 'GERAL';

-- Bloco 4: cores cujo nome e puramente numerico (ex.: "15") --------------------
select id, nome from public.cores where nome ~ '^[0-9]+$';
