-- Correção auditada: projetos W.Vetro PC3 cadastrados incorretamente como JC3.
-- Fonte de evidência: print real compartilhado pelo Francis mostrando
-- LINHA = L. SUPREMA, MODELO = PORTA DE CORRER 03 FOLHAS e os códigos
-- *SUCB-PC3-01EF, *SUCB-PC3-02-EF, *SUCB-PC3-03-EF, *SUCB-PC3-04-EF.
--
-- Esta migration NÃO tenta reinterpretar a composição interna de cada painel/folha.
-- Os valores antigos de composicao_folha_N foram inferidos de forma incorreta e são
-- limpos para {} até validação técnica humana. As variáveis globais permanecem no
-- catálogo para futuro redesenho, mas os vínculos criados sem evidência nas tipologias
-- L. Suprema > Janela de Correr 02/03/04/06 folhas são removidos.
--
-- Idempotência / segurança:
-- - usa chaves exatas de tipologia;
-- - identifica os 4 projetos pela ocorrência do código exato normalizado dentro do nome;
-- - não usa fuzzy/semelhança de nome;
-- - exige exatamente 4 registros-alvo e 4 códigos distintos;
-- - aborta se houver duplicidade/conflito;
-- - não cria presets novos;
-- - não altera produto, receita, preço, fórmula ou imagem.

begin;

do $$
declare
  v_janela_03 uuid;
  v_porta_03 uuid;
  v_total_alvos integer;
  v_distintos integer;
  v_outros integer;
  v_ambiguos integer;
begin
  select id into v_janela_03
  from public.tipologias
  where chave = 'l_suprema_janela_de_correr_03_folhas';

  select id into v_porta_03
  from public.tipologias
  where chave = 'l_suprema_porta_de_correr_03_folhas';

  if v_janela_03 is null then
    raise exception 'Gate falhou: tipologia exata l_suprema_janela_de_correr_03_folhas não encontrada';
  end if;

  if v_porta_03 is null then
    raise exception 'Gate falhou: tipologia exata l_suprema_porta_de_correr_03_folhas não encontrada';
  end if;

  -- O nome real do preset contém descrição + código entre parênteses, por exemplo:
  -- "JC3 — vidro + vidro + vidro (*SUCB-JC3-01EF)".
  -- Portanto o gate procura a SEQUÊNCIA EXATA do código normalizado dentro do nome,
  -- em vez de comparar o nome inteiro com o código puro.
  with base as (
    select
      p.id,
      regexp_replace(upper(p.nome), '[^A-Z0-9]', '', 'g') as nome_normalizado
    from public.engenharia_variaveis_preset p
    where p.tipologia_id in (v_janela_03, v_porta_03)
  ), candidatos as (
    select
      id,
      nome_normalizado,
      case
        when nome_normalizado like '%SUCBJC301EF%' or nome_normalizado like '%SUCBPC301EF%' then '01'
        when nome_normalizado like '%SUCBJC302EF%' or nome_normalizado like '%SUCBPC302EF%' then '02'
        when nome_normalizado like '%SUCBJC303EF%' or nome_normalizado like '%SUCBPC303EF%' then '03'
        when nome_normalizado like '%SUCBJC304EF%' or nome_normalizado like '%SUCBPC304EF%' then '04'
      end as codigo,
      ((nome_normalizado like '%SUCBJC301EF%' or nome_normalizado like '%SUCBPC301EF%')::int
       + (nome_normalizado like '%SUCBJC302EF%' or nome_normalizado like '%SUCBPC302EF%')::int
       + (nome_normalizado like '%SUCBJC303EF%' or nome_normalizado like '%SUCBPC303EF%')::int
       + (nome_normalizado like '%SUCBJC304EF%' or nome_normalizado like '%SUCBPC304EF%')::int) as ocorrencias
    from base
  )
  select
    count(*) filter (where codigo is not null),
    count(distinct codigo) filter (where codigo is not null),
    count(*) filter (where codigo is not null and ocorrencias <> 1)
  into v_total_alvos, v_distintos, v_ambiguos
  from candidatos;

  if v_ambiguos <> 0 then
    raise exception 'Gate falhou: existem % presets contendo mais de um código alvo', v_ambiguos;
  end if;

  if v_total_alvos <> 4 or v_distintos <> 4 then
    raise exception 'Gate falhou: esperado exatamente 4 presets PC3/JC3 distintos, encontrado total=% distintos=%', v_total_alvos, v_distintos;
  end if;

  -- Nenhum dos mesmos códigos pode existir em outra tipologia: isso indicaria
  -- conflito de cadastro e exige revisão humana antes de qualquer correção.
  select count(*) into v_outros
  from public.engenharia_variaveis_preset p
  where p.tipologia_id not in (v_janela_03, v_porta_03)
    and (
      regexp_replace(upper(p.nome), '[^A-Z0-9]', '', 'g') like '%SUCBJC301EF%'
      or regexp_replace(upper(p.nome), '[^A-Z0-9]', '', 'g') like '%SUCBPC301EF%'
      or regexp_replace(upper(p.nome), '[^A-Z0-9]', '', 'g') like '%SUCBJC302EF%'
      or regexp_replace(upper(p.nome), '[^A-Z0-9]', '', 'g') like '%SUCBPC302EF%'
      or regexp_replace(upper(p.nome), '[^A-Z0-9]', '', 'g') like '%SUCBJC303EF%'
      or regexp_replace(upper(p.nome), '[^A-Z0-9]', '', 'g') like '%SUCBPC303EF%'
      or regexp_replace(upper(p.nome), '[^A-Z0-9]', '', 'g') like '%SUCBJC304EF%'
      or regexp_replace(upper(p.nome), '[^A-Z0-9]', '', 'g') like '%SUCBPC304EF%'
    );

  if v_outros <> 0 then
    raise exception 'Gate falhou: existem % presets com os mesmos códigos em outra tipologia', v_outros;
  end if;
end $$;

-- Corrige identidade do projeto e elimina somente a estrutura inferida incorretamente.
with tipologia_correta as (
  select id
  from public.tipologias
  where chave = 'l_suprema_porta_de_correr_03_folhas'
), base as (
  select
    p.id,
    regexp_replace(upper(p.nome), '[^A-Z0-9]', '', 'g') as nome_normalizado
  from public.engenharia_variaveis_preset p
  join public.tipologias t on t.id = p.tipologia_id
  where t.chave in (
    'l_suprema_janela_de_correr_03_folhas',
    'l_suprema_porta_de_correr_03_folhas'
  )
), mapeado as (
  select
    id,
    case
      when nome_normalizado like '%SUCBJC301EF%' or nome_normalizado like '%SUCBPC301EF%' then '*SUCB-PC3-01EF'
      when nome_normalizado like '%SUCBJC302EF%' or nome_normalizado like '%SUCBPC302EF%' then '*SUCB-PC3-02-EF'
      when nome_normalizado like '%SUCBJC303EF%' or nome_normalizado like '%SUCBPC303EF%' then '*SUCB-PC3-03-EF'
      when nome_normalizado like '%SUCBJC304EF%' or nome_normalizado like '%SUCBPC304EF%' then '*SUCB-PC3-04-EF'
    end as nome_correto
  from base
), alvos as (
  select * from mapeado where nome_correto is not null
)
update public.engenharia_variaveis_preset p
set
  tipologia_id = tc.id,
  nome = a.nome_correto,
  valores = '{}'::jsonb,
  evidencia_validacao = case
    when coalesce(p.evidencia_validacao, '') ilike '%CORRECAO AUDITADA PC3 2026-08-19%'
      then p.evidencia_validacao
    else concat_ws(
      E'\n',
      nullif(p.evidencia_validacao, ''),
      'CORRECAO AUDITADA PC3 2026-08-19: o print W.Vetro de origem mostra L. SUPREMA > PORTA DE CORRER 03 FOLHAS e código PC3. O cadastro anterior como Janela/JC3 e os valores composicao_folha_N foram inferidos incorretamente. Identidade corrigida para PC3; valores estruturados limpos e pendentes de validação técnica humana. A imagem do projeto permanece evidência visual e não foi reinterpretada por esta migration.'
    )
  end,
  updated_at = now()
from alvos a
cross join tipologia_correta tc
where p.id = a.id;

-- Remove apenas os vínculos de composição adicionados às janelas Suprema sem
-- evidência suficiente no print que originou esta frente. Variáveis/opções globais
-- permanecem intactas para futuro uso após modelagem correta.
delete from public.engenharia_tipologia_variaveis etv
using public.tipologias t, public.engenharia_variaveis v
where etv.tipologia_id = t.id
  and etv.variavel_id = v.id
  and t.chave in (
    'l_suprema_janela_de_correr_02_folhas',
    'l_suprema_janela_de_correr_03_folhas',
    'l_suprema_janela_de_correr_04_folhas',
    'l_suprema_janela_de_correr_06_folhas'
  )
  and v.chave ~ '^composicao_folha_[1-6]$';

-- Pós-checks: abortam a transação se o estado final não for exatamente o esperado.
do $$
declare
  v_porta_03 uuid;
  v_janela_03 uuid;
  v_pc3 integer;
  v_jc3 integer;
  v_valores_nao_vazios integer;
  v_vinculos_janela integer;
begin
  select id into v_porta_03 from public.tipologias where chave = 'l_suprema_porta_de_correr_03_folhas';
  select id into v_janela_03 from public.tipologias where chave = 'l_suprema_janela_de_correr_03_folhas';

  select count(*) into v_pc3
  from public.engenharia_variaveis_preset
  where tipologia_id = v_porta_03
    and regexp_replace(upper(nome), '[^A-Z0-9]', '', 'g') in (
      'SUCBPC301EF','SUCBPC302EF','SUCBPC303EF','SUCBPC304EF'
    );

  select count(*) into v_jc3
  from public.engenharia_variaveis_preset
  where tipologia_id = v_janela_03
    and (
      regexp_replace(upper(nome), '[^A-Z0-9]', '', 'g') like '%SUCBJC301EF%'
      or regexp_replace(upper(nome), '[^A-Z0-9]', '', 'g') like '%SUCBPC301EF%'
      or regexp_replace(upper(nome), '[^A-Z0-9]', '', 'g') like '%SUCBJC302EF%'
      or regexp_replace(upper(nome), '[^A-Z0-9]', '', 'g') like '%SUCBPC302EF%'
      or regexp_replace(upper(nome), '[^A-Z0-9]', '', 'g') like '%SUCBJC303EF%'
      or regexp_replace(upper(nome), '[^A-Z0-9]', '', 'g') like '%SUCBPC303EF%'
      or regexp_replace(upper(nome), '[^A-Z0-9]', '', 'g') like '%SUCBJC304EF%'
      or regexp_replace(upper(nome), '[^A-Z0-9]', '', 'g') like '%SUCBPC304EF%'
    );

  select count(*) into v_valores_nao_vazios
  from public.engenharia_variaveis_preset
  where tipologia_id = v_porta_03
    and regexp_replace(upper(nome), '[^A-Z0-9]', '', 'g') in (
      'SUCBPC301EF','SUCBPC302EF','SUCBPC303EF','SUCBPC304EF'
    )
    and valores <> '{}'::jsonb;

  select count(*) into v_vinculos_janela
  from public.engenharia_tipologia_variaveis etv
  join public.tipologias t on t.id = etv.tipologia_id
  join public.engenharia_variaveis v on v.id = etv.variavel_id
  where t.chave in (
    'l_suprema_janela_de_correr_02_folhas',
    'l_suprema_janela_de_correr_03_folhas',
    'l_suprema_janela_de_correr_04_folhas',
    'l_suprema_janela_de_correr_06_folhas'
  )
    and v.chave ~ '^composicao_folha_[1-6]$';

  if v_pc3 <> 4 then
    raise exception 'Pós-check falhou: esperado 4 presets PC3 em Porta de Correr 03 Folhas, encontrado %', v_pc3;
  end if;
  if v_jc3 <> 0 then
    raise exception 'Pós-check falhou: ainda existem % presets alvo na tipologia Janela de Correr 03 Folhas', v_jc3;
  end if;
  if v_valores_nao_vazios <> 0 then
    raise exception 'Pós-check falhou: % presets PC3 ainda possuem valores estruturados inferidos', v_valores_nao_vazios;
  end if;
  if v_vinculos_janela <> 0 then
    raise exception 'Pós-check falhou: ainda existem % vínculos composicao_folha_N nas janelas Suprema alvo', v_vinculos_janela;
  end if;
end $$;

commit;
