-- Materializa a referência histórica PG2 Suprema com vidro e arremate MP347.
-- Evidência: 4 itens históricos com a mesma assinatura técnica.
-- A referência permanece em validação e inativa; não libera produção automática.

insert into public.engenharia_tipologia_formulas_corte (
  tipologia_id,
  configuracao_chave,
  configuracao_label,
  variaveis,
  pecas,
  vidro,
  acessorios,
  status,
  ativo,
  observacoes,
  metadados_editor
)
select
  '27e16c88-3faf-443d-9dba-522dd138c639'::uuid,
  'pg2_suprema_vidro_arremate_comparador',
  'PG2-SUPREMA · vidro · arremate MP347 · sem contramarco · referência histórica',
  '[]'::jsonb,
  '[
    {"eixo":"H","codigo":"25-548 (L-715)","formula":"Altura-30","descricao":"Marco/estrutura vertical","quantidade":2},
    {"eixo":"L","codigo":"25-548 (L-715)","formula":"Largura/2-21","descricao":"Marco/estrutura horizontal por folha","quantidade":2},
    {"codigo":"CL006","formula":"21","descricao":"Calço CL006 21 mm","quantidade":4},
    {"codigo":"CL006","formula":"30","descricao":"Calço CL006 30 mm","quantidade":2},
    {"codigo":"CL011","formula":"21","descricao":"Calço CL011 21 mm","quantidade":8},
    {"codigo":"CL011","formula":"30","descricao":"Calço CL011 30 mm","quantidade":4},
    {"eixo":"H","codigo":"MP347","formula":"Altura+22","descricao":"Arremate vertical","quantidade":2},
    {"eixo":"L","codigo":"MP347","formula":"Largura+44","descricao":"Arremate horizontal","quantidade":1},
    {"eixo":"H","codigo":"SU102","formula":"Altura-211","descricao":"Baguete vertical","quantidade":4},
    {"eixo":"L","codigo":"SU102","formula":"Largura/2-140","descricao":"Baguete horizontal","quantidade":4},
    {"eixo":"H","codigo":"SU111","formula":"Altura-49","descricao":"Montante da folha","quantidade":4},
    {"eixo":"L","codigo":"SU111","formula":"Largura/2-40","descricao":"Travessa estrutural da folha","quantidade":2},
    {"eixo":"L","codigo":"SU225","formula":"Largura/2-140","descricao":"Travessa inferior","quantidade":2},
    {"eixo":"H","codigo":"SU279","formula":"Altura-4","descricao":"Marco vertical","quantidade":2},
    {"eixo":"L","codigo":"SU279","formula":"Largura-4","descricao":"Marco horizontal","quantidade":1}
  ]'::jsonb,
  '{"quantidade":2,"formula_largura":"Largura/2-146","formula_altura":"Altura-193"}'::jsonb,
  '[
    {"codigo":"BUC755","quantidade_referencia":13,"status":"referencia"},
    {"codigo":"CON295","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"DOB840","formula_quantidade":"6","status":"em_validacao"},
    {"codigo":"FEC338","formula_quantidade":"2","status":"em_validacao"},
    {"codigo":"FIT206","formula_quantidade":"(Largura+2*Altura)/1000","status":"em_validacao"},
    {"codigo":"FRA822","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"GUA171","formula_quantidade":"Largura/1000","status":"em_validacao"},
    {"codigo":"GUA239","formula_quantidade":"(Largura+2*Altura)/1000","status":"em_validacao"},
    {"codigo":"GUA258","formula_quantidade":"(Largura+4*Altura)/1000","status":"em_validacao"},
    {"codigo":"GUA259","formula_quantidade":"(2*Largura+4*Altura)/1000","status":"em_validacao"},
    {"codigo":"MAC927","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"NYL042","formula_quantidade":"4","status":"em_validacao"},
    {"codigo":"NYL190","quantidade_referencia":13,"status":"referencia"},
    {"codigo":"PAR1025","quantidade_referencia":13,"status":"referencia"},
    {"codigo":"PAR1037","quantidade_referencia":13,"status":"referencia"},
    {"codigo":"PAR435","formula_quantidade":"8","status":"em_validacao"},
    {"codigo":"REBACA4X10","quantidade_referencia":14,"status":"referencia"},
    {"codigo":"SIL-PU","formula_quantidade":"(Largura+2*Altura)/12000","status":"em_validacao"}
  ]'::jsonb,
  'em_validacao',
  false,
  'Referência PG2 Suprema vidro/arremate reconstruída de 4 itens históricos W.Vetro com assinatura dominante. Quatro medidas passaram na regressão técnica sem divergências duras. BUC755, NYL190, PAR1025, PAR1037 e REBACA4X10 permanecem como regras pendentes. Não libera produção automática.',
  jsonb_build_object(
    'origem_validacao','wvetro_comparador',
    'validacao_data','2026-10-01',
    'codigo_wvetro','SUCB-PG2-01',
    'familia','vidro',
    'arremate','MP347',
    'contramarco','sem',
    'amostras_historicas_assinatura',4,
    'amostras_regressao',4,
    'comparacao_sem_divergencia_dura',true,
    'regra_pendente_atlas',5,
    'regras_pendentes',jsonb_build_array('BUC755','NYL190','PAR1025','PAR1037','REBACA4X10'),
    'comparacao_aprovada',false,
    'liberacao_operacional',false,
    'assinatura_perfis',jsonb_build_array(
      '25-548 (L-715)','CL006','CL011','MP347','SU102','SU111','SU225','SU279'
    ),
    'assinatura_acessorios',jsonb_build_array(
      'BUC755','CON295','DOB840','FEC338','FIT206','FRA822','GUA171','GUA239',
      'GUA258','GUA259','MAC927','NYL042','NYL190','PAR1025','PAR1037',
      'PAR435','REBACA4X10','SIL-PU'
    )
  )
where not exists (
  select 1
  from public.engenharia_tipologia_formulas_corte f
  where f.tipologia_id='27e16c88-3faf-443d-9dba-522dd138c639'::uuid
    and f.configuracao_chave='pg2_suprema_vidro_arremate_comparador'
);
