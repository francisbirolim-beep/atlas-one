-- Reconciliação de proveniência dos 1.307 perfis preexistentes no Atlas
-- confirmados na fonte W.Vetro `ExportWWPerfil (1)(1).xlsx` em 2026-08-17.
--
-- Objetivo:
--   enriquecer somente proveniência dos registros já existentes.
--   NÃO insere produtos e NÃO sobrescreve campos operacionais/técnicos.
--
-- Auditoria read-only:
--   fonte W.Vetro: 1.307 códigos únicos;
--   Atlas: 1.307 perfis;
--   correspondências por código: 1.307;
--   EXISTENTE_IGUAL: 1.235;
--   EXISTENTE_FONTE_NAO_PROMOVIDA: 72;
--   divergência operacional real: 0.
--
-- Os 72 dados não promovidos são deliberados:
--   68 registros com Nome Fabricante = 16 e marca Atlas vazia;
--    4 registros com NCM = 16 e NCM Atlas vazio.
--
-- Estratégia de compactação segura:
--   campos que a auditoria confirmou idênticos entre fonte e Atlas são
--   reconstruídos a partir do snapshot Atlas SOMENTE se o hash integral do
--   snapshot vivo continuar exatamente igual ao hash auditado.
--   Os valores crus que diferem do Atlas/default ficam na tabela de exceções
--   abaixo (249 códigos). Um segundo hash confirma que a fonte reconstruída
--   coincide exatamente com os dados auditados da planilha.
--
-- Fonte recebida SHA-256:
--   d13da3e27afbca744fc4d0bed360042b55d7e1a9c0c47755a4af0685ef2ebc07
-- Snapshot Atlas CSV read-only SHA-256:
--   fca1d9672911b3c8770260bbac8b0c24319f1bb52519d528ed68c8d1f1e9b898
-- Hash MD5 canônico do snapshot Atlas auditado:
--   ef179d902fbfc13dfa2f32a9e0ffd322
-- Hash MD5 canônico dos dados da fonte reconstruída:
--   1de834f0f4bc2b791b73479529e3392b
--
-- `Tamanho` da fonte é gravado SOMENTE em tamanho_barra_mm_origem.
-- Não inferir que 6 significa 6000 mm e não corrigir 60000 automaticamente.

begin;

create temporary table _perfil_wvetro_excecoes (
  codigo_norm text primary key,
  codigo_raw_override text,
  descricao_raw_override text,
  tamanho_raw_override numeric,
  sucata_raw_override numeric,
  obs_raw_override text,
  cod_barras_raw_override text,
  fabricante_raw_override text,
  ncm_raw_override text
) on commit drop;

insert into _perfil_wvetro_excecoes (
  codigo_norm,
  codigo_raw_override,
  descricao_raw_override,
  tamanho_raw_override,
  sucata_raw_override,
  obs_raw_override,
  cod_barras_raw_override,
  fabricante_raw_override,
  ncm_raw_override
) values
  ('25517', NULL, 'MARCO LATERAL ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('30-245', NULL, NULL, NULL, NULL, NULL, '30-245              ', NULL, NULL),
  ('32-145/CB-273', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('42-002', NULL, NULL, 6500, NULL, NULL, '42-002              ', NULL, NULL),
  ('42-004', NULL, NULL, 60000, NULL, NULL, NULL, NULL, NULL),
  ('42-007', NULL, NULL, 6500, NULL, NULL, '42-007              ', NULL, NULL),
  ('42-008', NULL, NULL, 6500, NULL, NULL, '42-008              ', NULL, NULL),
  ('42-012', NULL, NULL, 6500, NULL, NULL, '42-012              ', NULL, NULL),
  ('42-014', NULL, NULL, 6500, NULL, NULL, '42-014              ', NULL, NULL),
  ('42-023', NULL, NULL, 6500, NULL, NULL, '42-023              ', NULL, NULL),
  ('42-025', NULL, NULL, 6500, NULL, NULL, '42-025              ', NULL, NULL),
  ('42-026', NULL, NULL, 6500, NULL, NULL, '42-026              ', NULL, NULL),
  ('42-028', NULL, NULL, 6500, NULL, NULL, '42-028              ', NULL, NULL),
  ('42-032', NULL, NULL, 6500, NULL, NULL, '42-032              ', NULL, NULL),
  ('42-033', NULL, NULL, NULL, NULL, NULL, '42-003              ', NULL, NULL),
  ('42-035', NULL, NULL, 6500, NULL, NULL, '42-035              ', NULL, NULL),
  ('42-061', NULL, NULL, NULL, NULL, NULL, '42,061              ', NULL, NULL),
  ('42-062', NULL, NULL, NULL, NULL, NULL, '42-062              ', NULL, NULL),
  ('42-063', NULL, NULL, NULL, NULL, NULL, '42-063              ', NULL, NULL),
  ('42-064', NULL, NULL, NULL, NULL, NULL, '42-064              ', NULL, NULL),
  ('42-453/CB-276', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('50X25', NULL, 'TUBO RETANGULAR 50X25 ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('78-719', NULL, 'TUBO RETANGULAR 102X51 ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('A-096/FC-017', NULL, NULL, NULL, NULL, NULL, 'PEREIRA BRITO       ', NULL, NULL),
  ('A-102', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-103', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-105', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-106', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-108', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-109', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-110', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-112', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-113', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-117', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-119', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-120', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-122', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-124', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-126', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-128', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-130', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-132', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-134', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-136', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-138', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-140', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('A-142', NULL, NULL, NULL, NULL, 'MERCADO', NULL, NULL, NULL),
  ('AL-12', NULL, 'PERFIL U-40 15.87X15.87 ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('ALS-092', NULL, '	 TRAVESSA SUPERIOR DA FOLHA COM OLHAL', NULL, NULL, NULL, NULL, NULL, NULL),
  ('AT-100', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-101', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-102', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-103', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-104', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-105', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-106', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-107', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-108', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-109', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-110', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-111', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-112', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-113', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-114', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-115', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-116', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-117', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-118', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-119', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-120', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-121', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-122', NULL, NULL, NULL, 100, NULL, NULL, NULL, NULL),
  ('AT-123', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-124', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-125', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-126', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-127', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-128', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-129', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-130', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-131', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-132', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-133', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-134', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-135', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-136', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-137', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-138', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-139', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-140', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-141', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-142', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-143', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-144', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-145', NULL, NULL, NULL, 400, NULL, NULL, NULL, NULL),
  ('AT-146', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AT-147', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AT-148', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AT-149', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AT-150', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AT-151', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AT-152', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AT-153', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AT-154', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AT-155', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AT-156', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AT-157', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AT-158', NULL, NULL, NULL, 1000, NULL, NULL, NULL, NULL),
  ('AT-159', NULL, NULL, NULL, 150, NULL, NULL, NULL, NULL),
  ('AT-160', NULL, NULL, NULL, 150, NULL, NULL, NULL, NULL),
  ('AT-161', NULL, NULL, NULL, 150, NULL, NULL, NULL, NULL),
  ('AT-162', NULL, NULL, NULL, 150, NULL, NULL, NULL, NULL),
  ('AT-163', NULL, NULL, NULL, 150, NULL, NULL, NULL, NULL),
  ('AT-164', NULL, NULL, NULL, 150, NULL, NULL, NULL, NULL),
  ('AT-165', NULL, NULL, NULL, 150, NULL, NULL, NULL, NULL),
  ('AT-166', NULL, NULL, NULL, 500, NULL, NULL, NULL, NULL),
  ('AT-167', NULL, NULL, NULL, 500, NULL, NULL, NULL, NULL),
  ('AT-168', NULL, NULL, NULL, 500, NULL, NULL, NULL, NULL),
  ('AT-169', NULL, NULL, NULL, 500, NULL, NULL, NULL, NULL),
  ('AT-170', NULL, NULL, NULL, 500, NULL, NULL, NULL, NULL),
  ('AT-171', NULL, NULL, NULL, 500, NULL, NULL, NULL, NULL),
  ('AT-172', NULL, NULL, NULL, 2000, NULL, NULL, NULL, NULL),
  ('AT-173', NULL, NULL, NULL, 2000, NULL, NULL, NULL, NULL),
  ('AT-174', NULL, NULL, NULL, 2000, NULL, NULL, NULL, NULL),
  ('AT-175', NULL, NULL, NULL, 300, NULL, NULL, NULL, NULL),
  ('AT-176', NULL, NULL, NULL, 300, NULL, NULL, NULL, NULL),
  ('AT-177', NULL, NULL, NULL, 450, NULL, NULL, NULL, NULL),
  ('AT-178', NULL, NULL, NULL, 450, NULL, NULL, NULL, NULL),
  ('AT-179', NULL, NULL, NULL, 12, NULL, NULL, NULL, NULL),
  ('CG-1012', NULL, 'MONTANTE PARA 3 FUROS	', NULL, NULL, NULL, NULL, NULL, NULL),
  ('CHU-864', NULL, NULL, NULL, NULL, 'CHU-864', NULL, NULL, NULL),
  ('DP-089/DECAMP', NULL, 'ESTRUTURA PARA RIPADO ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('DP-124/DECAMP', NULL, 'TUBO RETANGULAR 140X50,8 ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('FA-226', NULL, 'ANCORAGEM CENTRAL PARA COLUNAS ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('FA-406', NULL, 'TRAVESSA SUPERIOR E INFERIOR DO QUADRO FIXO ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('FC-087', NULL, 'PERFIL RUFO ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('L-093', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '16'),
  ('MP-350', NULL, 'ARREMATE FACE INTERNA 60MM ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('NG-092', 'NG-092 ', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('P-215', NULL, 'PERFIL DE ALUMÍNIO "U" 9 X 15 MM ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('PR42-003/DECAMP', NULL, 'CAIXILHO MUXARABI ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('PS-307', NULL, 'COLUNA CENTRAL 120 MM ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('PS-308', NULL, 'COLUNA CENTRAL 180 MM ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('PS-354', NULL, 'COLUNA CENTRAL 54 MM ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('PT-009', NULL, 'PERFIL "T" 25,4 X 25,4 X 1,58 MM ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('PU206', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '16'),
  ('PU207', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '16'),
  ('RP-001', NULL, 'RIPADO ESPECIAL ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('RP-002', NULL, 'RIPADO ESPECIAL ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('TMF-085/DECAMP', NULL, 'CLICK ', NULL, NULL, NULL, NULL, NULL, NULL),
  ('TQ-10X10X1,00MM', NULL, NULL, 6, NULL, NULL, NULL, NULL, NULL),
  ('TR-1/2"X1,5MM', NULL, NULL, 6, NULL, NULL, NULL, NULL, NULL),
  ('TRT-40X15X1,20MM', NULL, NULL, 6, NULL, NULL, NULL, NULL, NULL),
  ('TRT-50X20X1.50MM', NULL, NULL, 6, NULL, NULL, NULL, NULL, NULL),
  ('TRT-50X70', NULL, NULL, 6, NULL, NULL, NULL, NULL, NULL),
  ('TRT-60X40X1.5', NULL, NULL, 6, NULL, NULL, NULL, NULL, NULL),
  ('US280', NULL, 'VENEZIANA VENTILADA 9,7 X 74	', NULL, NULL, NULL, NULL, NULL, NULL),
  ('VT-1904', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '16');

-- Observação: a lista acima é gerada pela auditoria e contém todos os códigos
-- cujo dado cru difere do valor operacional/default usado na reconstrução.
-- Os códigos restantes são reconstruídos somente após o Gate 1 confirmar o
-- hash integral do snapshot Atlas auditado.

-- Gate 1: o snapshot vivo precisa continuar exatamente igual ao auditado.
do $$
declare
  v_total integer;
  v_hash text;
  v_excecoes integer;
  v_excecoes_orfas integer;
begin
  select count(*) into v_total
  from public.produtos
  where categoria = 'perfil';

  if v_total <> 1307 then
    raise exception 'Snapshot Atlas mudou: esperava 1307 perfis; encontrou %', v_total;
  end if;

  select md5(
    string_agg(
      concat_ws(
        E'\x1f',
        coalesce(p.id::text, ''),
        coalesce(p.codigo, ''),
        coalesce(p.nome, ''),
        coalesce(p.unidade, ''),
        coalesce(round(p.peso_kg_m * 1000000)::bigint::text, ''),
        coalesce(p.ncm, ''),
        coalesce(p.marca, ''),
        case when p.ativo then 't' else 'f' end,
        coalesce(round(p.tamanho_barra_mm * 1000000)::bigint::text, ''),
        coalesce(p.origem, '')
      ),
      E'\x1e'
      order by upper(trim(p.codigo))
    )
  )
  into v_hash
  from public.produtos p
  where p.categoria = 'perfil';

  if v_hash is distinct from 'ef179d902fbfc13dfa2f32a9e0ffd322' then
    raise exception 'Snapshot Atlas mudou: hash auditado ef179d902fbfc13dfa2f32a9e0ffd322, hash atual %', v_hash;
  end if;

  select count(*) into v_excecoes from _perfil_wvetro_excecoes;
  if v_excecoes <> 249 then
    raise exception 'Esperava 249 códigos com exceções de origem; encontrou %', v_excecoes;
  end if;

  select count(*) into v_excecoes_orfas
  from _perfil_wvetro_excecoes e
  left join public.produtos p
    on p.categoria = 'perfil'
   and upper(trim(p.codigo)) = e.codigo_norm
  where p.id is null;

  if v_excecoes_orfas <> 0 then
    raise exception 'Há % exceção(ões) sem perfil correspondente no snapshot Atlas', v_excecoes_orfas;
  end if;
end $$;

create temporary table _reconciliacao_perfis_wvetro on commit drop as
select
  p.id as atlas_id,
  upper(trim(p.codigo)) as codigo_norm,
  coalesce(e.codigo_raw_override, p.codigo) as codigo_origem_raw,
  coalesce(e.descricao_raw_override, substr(p.nome, length(p.codigo) + 4)) as descricao_fonte,
  p.peso_kg_m as peso_fonte,
  p.unidade as unidade_fonte,
  coalesce(e.ncm_raw_override, p.ncm) as ncm_fonte,
  coalesce(e.tamanho_raw_override, 6000::numeric) as tamanho_fonte,
  coalesce(e.sucata_raw_override, 0::numeric) as sucata_fonte,
  'Sim'::text as ativo_fonte,
  coalesce(e.obs_raw_override, '16'::text) as obs_fonte,
  coalesce(e.cod_barras_raw_override, repeat(' ', 20)) as cod_barras_fonte,
  coalesce(e.fabricante_raw_override, p.marca) as fabricante_fonte,
  case
    when trim(coalesce(e.ncm_raw_override, p.ncm, '')) = '16'
      or trim(coalesce(e.fabricante_raw_override, p.marca, '')) = '16'
      then 'EXISTENTE_FONTE_NAO_PROMOVIDA'
    else 'EXISTENTE_IGUAL'
  end as status_reconciliacao,
  nullif(
    concat_ws(
      ',',
      case when trim(coalesce(e.ncm_raw_override, p.ncm, '')) = '16' then 'NCM_FONTE_NAO_PROMOVIDO' end,
      case when trim(coalesce(e.fabricante_raw_override, p.marca, '')) = '16' then 'FABRICANTE_FONTE_NAO_PROMOVIDO' end
    ),
    ''
  ) as motivos_nao_promovidos,
  nullif(
    concat_ws(
      ',',
      case
        when trim(coalesce(e.ncm_raw_override, p.ncm, '')) in ('', '0', '12345678', '12345667') then 'NCM_PLACEHOLDER'
        when trim(coalesce(e.ncm_raw_override, p.ncm, '')) !~ '^[0-9]{8}$' then 'NCM_FORMATO_ATIPICO'
      end,
      case when p.peso_kg_m > 50 then 'PESO_MUITO_ALTO' end,
      case when coalesce(e.tamanho_raw_override, 6000::numeric) < 1000 or coalesce(e.tamanho_raw_override, 6000::numeric) > 10000 then 'TAMANHO_ATIPICO' end,
      case when trim(coalesce(e.fabricante_raw_override, p.marca, '')) = '16' then 'FABRICANTE_NUMERICO_16' end,
      case when trim(coalesce(e.cod_barras_raw_override, repeat(' ', 20))) <> '' then 'COD_BARRAS_PREENCHIDO' end,
      case when coalesce(e.sucata_raw_override, 0::numeric) <> 0 then 'SUCATA_NAO_ZERO' end
    ),
    ''
  ) as flags_revisao
from public.produtos p
left join _perfil_wvetro_excecoes e
  on e.codigo_norm = upper(trim(p.codigo))
where p.categoria = 'perfil';

-- Gate 2: a fonte reconstruída precisa ser exatamente a fonte auditada.
do $$
declare
  v_total integer;
  v_hash text;
  v_duplicados integer;
  v_iguais integer;
  v_nao_promovidos integer;
  v_unidade_invalida integer;
  v_ncm_placeholder integer;
  v_ncm_atipico integer;
  v_tamanho_atipico integer;
  v_peso_alto integer;
  v_fabricante_16 integer;
  v_cod_barras integer;
  v_sucata integer;
  v_ncm_16 integer;
  v_fab_16 integer;
begin
  select count(*) into v_total from _reconciliacao_perfis_wvetro;
  if v_total <> 1307 then raise exception 'Fonte reconstruída esperava 1307 linhas; encontrou %', v_total; end if;

  select count(*) into v_duplicados
  from (
    select upper(regexp_replace(trim(codigo_origem_raw), '\s+', ' ', 'g'))
    from _reconciliacao_perfis_wvetro
    group by 1
    having count(*) > 1
  ) d;
  if v_duplicados <> 0 then raise exception 'Fonte reconstruída contém % código(s) duplicado(s)', v_duplicados; end if;

  select md5(
    string_agg(
      concat_ws(
        E'\x1f',
        coalesce(codigo_origem_raw, ''),
        coalesce(descricao_fonte, ''),
        coalesce(round(peso_fonte * 1000000)::bigint::text, ''),
        coalesce(unidade_fonte, ''),
        coalesce(ncm_fonte, ''),
        coalesce(round(tamanho_fonte * 1000000)::bigint::text, ''),
        coalesce(round(sucata_fonte * 1000000)::bigint::text, ''),
        coalesce(ativo_fonte, ''),
        coalesce(obs_fonte, ''),
        coalesce(cod_barras_fonte, ''),
        coalesce(fabricante_fonte, '')
      ),
      E'\x1e'
      order by codigo_norm
    )
  ) into v_hash
  from _reconciliacao_perfis_wvetro;

  if v_hash is distinct from '1de834f0f4bc2b791b73479529e3392b' then
    raise exception 'Fonte reconstruída não coincide com a planilha auditada: hash esperado 1de834f0f4bc2b791b73479529e3392b, atual %', v_hash;
  end if;

  select count(*) into v_iguais from _reconciliacao_perfis_wvetro where status_reconciliacao = 'EXISTENTE_IGUAL';
  if v_iguais <> 1235 then raise exception 'Esperava 1235 EXISTENTE_IGUAL; encontrou %', v_iguais; end if;

  select count(*) into v_nao_promovidos from _reconciliacao_perfis_wvetro where status_reconciliacao = 'EXISTENTE_FONTE_NAO_PROMOVIDA';
  if v_nao_promovidos <> 72 then raise exception 'Esperava 72 EXISTENTE_FONTE_NAO_PROMOVIDA; encontrou %', v_nao_promovidos; end if;

  select count(*) into v_unidade_invalida
  from (
    with esperado(unidade, quantidade) as (values ('BR',1256), ('MT',26), ('UN',25)),
    atual as (select upper(trim(unidade_fonte)) as unidade, count(*)::integer as quantidade from _reconciliacao_perfis_wvetro group by 1)
    select coalesce(e.unidade, a.unidade)
    from esperado e full join atual a using (unidade)
    where coalesce(e.quantidade, -1) <> coalesce(a.quantidade, -1)
  ) x;
  if v_unidade_invalida <> 0 then raise exception 'Distribuição de unidades não coincide com BR=1256 MT=26 UN=25'; end if;

  select count(*) into v_ncm_placeholder from _reconciliacao_perfis_wvetro where position('NCM_PLACEHOLDER' in coalesce(flags_revisao, '')) > 0;
  if v_ncm_placeholder <> 221 then raise exception 'Esperava 221 NCM placeholder; encontrou %', v_ncm_placeholder; end if;

  select count(*) into v_ncm_atipico from _reconciliacao_perfis_wvetro where position('NCM_FORMATO_ATIPICO' in coalesce(flags_revisao, '')) > 0;
  if v_ncm_atipico <> 18 then raise exception 'Esperava 18 NCM em formato atípico; encontrou %', v_ncm_atipico; end if;

  select count(*) into v_tamanho_atipico from _reconciliacao_perfis_wvetro where position('TAMANHO_ATIPICO' in coalesce(flags_revisao, '')) > 0;
  if v_tamanho_atipico <> 7 then raise exception 'Esperava 7 tamanhos atípicos; encontrou %', v_tamanho_atipico; end if;

  select count(*) into v_peso_alto from _reconciliacao_perfis_wvetro where position('PESO_MUITO_ALTO' in coalesce(flags_revisao, '')) > 0;
  if v_peso_alto <> 2 then raise exception 'Esperava 2 pesos muito altos; encontrou %', v_peso_alto; end if;

  select count(*) into v_fabricante_16 from _reconciliacao_perfis_wvetro where position('FABRICANTE_NUMERICO_16' in coalesce(flags_revisao, '')) > 0;
  if v_fabricante_16 <> 68 then raise exception 'Esperava 68 fabricantes numéricos 16; encontrou %', v_fabricante_16; end if;

  select count(*) into v_cod_barras from _reconciliacao_perfis_wvetro where position('COD_BARRAS_PREENCHIDO' in coalesce(flags_revisao, '')) > 0;
  if v_cod_barras <> 61 then raise exception 'Esperava 61 códigos de barras preenchidos; encontrou %', v_cod_barras; end if;

  select count(*) into v_sucata from _reconciliacao_perfis_wvetro where position('SUCATA_NAO_ZERO' in coalesce(flags_revisao, '')) > 0;
  if v_sucata <> 83 then raise exception 'Esperava 83 valores de sucata não zero; encontrou %', v_sucata; end if;

  select count(*) into v_ncm_16 from _reconciliacao_perfis_wvetro where motivos_nao_promovidos = 'NCM_FONTE_NAO_PROMOVIDO' and trim(coalesce(ncm_fonte, '')) = '16';
  if v_ncm_16 <> 4 then raise exception 'Esperava exatamente 4 NCM=16 não promovidos; encontrou %', v_ncm_16; end if;

  select count(*) into v_fab_16 from _reconciliacao_perfis_wvetro where motivos_nao_promovidos = 'FABRICANTE_FONTE_NAO_PROMOVIDO' and trim(coalesce(fabricante_fonte, '')) = '16';
  if v_fab_16 <> 68 then raise exception 'Esperava exatamente 68 fabricantes=16 não promovidos; encontrou %', v_fab_16; end if;
end $$;

create temporary table _atlas_perfis_protegidos_antes on commit drop as
select
  p.id,
  (to_jsonb(p) - ARRAY['codigo_origem','origem','unidade_origem','tamanho_barra_mm_origem','ncm_origem','dados_origem','updated_at']::text[]) as protegido
from public.produtos p
join _reconciliacao_perfis_wvetro c on c.atlas_id = p.id;

update public.produtos p
set
  codigo_origem = c.codigo_origem_raw,
  origem = 'wvetro',
  unidade_origem = c.unidade_fonte,
  tamanho_barra_mm_origem = c.tamanho_fonte,
  ncm_origem = case when trim(coalesce(c.ncm_fonte, '')) = '' then null else c.ncm_fonte end,
  dados_origem = coalesce(p.dados_origem, '{}'::jsonb) || jsonb_build_object(
    'fonte', 'ExportWWPerfil (1)(1).xlsx',
    'fonte_sha256', 'd13da3e27afbca744fc4d0bed360042b55d7e1a9c0c47755a4af0685ef2ebc07',
    'reconciliacao', '2026-08-17',
    'snapshot_atlas_sha256', 'fca1d9672911b3c8770260bbac8b0c24319f1bb52519d528ed68c8d1f1e9b898',
    'atlas_snapshot_md5', 'ef179d902fbfc13dfa2f32a9e0ffd322',
    'fonte_dados_md5', '1de834f0f4bc2b791b73479529e3392b',
    'proveniencia_tipo', 'wvetro_reconciliado',
    'codigo_raw', c.codigo_origem_raw,
    'descricao_raw', c.descricao_fonte,
    'peso_raw', c.peso_fonte,
    'unidade_raw', c.unidade_fonte,
    'ncm_raw', c.ncm_fonte,
    'tamanho_raw', c.tamanho_fonte,
    'sucata_raw', c.sucata_fonte,
    'ativo_raw', c.ativo_fonte,
    'obs_raw', c.obs_fonte,
    'cod_barras_raw', c.cod_barras_fonte,
    'fabricante_raw', c.fabricante_fonte,
    'status_reconciliacao', c.status_reconciliacao,
    'motivos_nao_promovidos', c.motivos_nao_promovidos,
    'flags_revisao', c.flags_revisao
  ),
  updated_at = now()
from _reconciliacao_perfis_wvetro c
where p.id = c.atlas_id;

do $$
declare
  v_atualizados integer;
  v_proveniencia_incompleta integer;
  v_protegido_alterado integer;
  v_tamanho_promovido integer;
  v_ncm_16_promovido integer;
  v_fabricante_16_promovido integer;
begin
  select count(*) into v_atualizados
  from public.produtos p join _reconciliacao_perfis_wvetro c on c.atlas_id = p.id
  where p.origem = 'wvetro';
  if v_atualizados <> 1307 then raise exception 'Pós-reconciliação esperava 1307 perfis com origem wvetro; encontrou %', v_atualizados; end if;

  select count(*) into v_proveniencia_incompleta
  from public.produtos p join _reconciliacao_perfis_wvetro c on c.atlas_id = p.id
  where p.codigo_origem is distinct from c.codigo_origem_raw
     or p.unidade_origem is distinct from c.unidade_fonte
     or p.tamanho_barra_mm_origem is distinct from c.tamanho_fonte
     or p.ncm_origem is distinct from (case when trim(coalesce(c.ncm_fonte, '')) = '' then null else c.ncm_fonte end)
     or p.dados_origem ->> 'fonte' is distinct from 'ExportWWPerfil (1)(1).xlsx'
     or p.dados_origem ->> 'fonte_sha256' is distinct from 'd13da3e27afbca744fc4d0bed360042b55d7e1a9c0c47755a4af0685ef2ebc07'
     or p.dados_origem ->> 'atlas_snapshot_md5' is distinct from 'ef179d902fbfc13dfa2f32a9e0ffd322'
     or p.dados_origem ->> 'fonte_dados_md5' is distinct from '1de834f0f4bc2b791b73479529e3392b'
     or p.dados_origem ->> 'status_reconciliacao' is distinct from c.status_reconciliacao;
  if v_proveniencia_incompleta <> 0 then raise exception 'Pós-reconciliação encontrou % perfil(is) com proveniência incompleta', v_proveniencia_incompleta; end if;

  select count(*) into v_protegido_alterado
  from _atlas_perfis_protegidos_antes a
  join public.produtos p on p.id = a.id
  where (to_jsonb(p) - ARRAY['codigo_origem','origem','unidade_origem','tamanho_barra_mm_origem','ncm_origem','dados_origem','updated_at']::text[]) is distinct from a.protegido;
  if v_protegido_alterado <> 0 then raise exception 'Pós-reconciliação detectou % perfil(is) com campo protegido alterado', v_protegido_alterado; end if;

  select count(*) into v_tamanho_promovido
  from public.produtos p join _reconciliacao_perfis_wvetro c on c.atlas_id = p.id
  where p.tamanho_barra_mm is not null;
  if v_tamanho_promovido <> 0 then raise exception 'Tamanho operacional foi promovido indevidamente em % perfil(is)', v_tamanho_promovido; end if;

  select count(*) into v_ncm_16_promovido
  from public.produtos p join _reconciliacao_perfis_wvetro c on c.atlas_id = p.id
  where c.motivos_nao_promovidos = 'NCM_FONTE_NAO_PROMOVIDO' and coalesce(p.ncm, '') <> '';
  if v_ncm_16_promovido <> 0 then raise exception 'NCM=16 foi promovido indevidamente em % perfil(is)', v_ncm_16_promovido; end if;

  select count(*) into v_fabricante_16_promovido
  from public.produtos p join _reconciliacao_perfis_wvetro c on c.atlas_id = p.id
  where c.motivos_nao_promovidos = 'FABRICANTE_FONTE_NAO_PROMOVIDO' and coalesce(p.marca, '') <> '';
  if v_fabricante_16_promovido <> 0 then raise exception 'Fabricante=16 foi promovido indevidamente em % perfil(is)', v_fabricante_16_promovido; end if;
end $$;

commit;
