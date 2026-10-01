-- Materializa a referência histórica PTA3 Suprema família B já validada pelo comparador W.Vetro.
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
  'c7a9d371-184c-4daa-8db1-d8c60cc3f008'::uuid,
  'pta3_suprema_familia_b_comparador',
  'PTA3-SUPREMA · veneziana · família B · arremate 3 lados · referência histórica',
  '[]'::jsonb,
  '[
    {"eixo":"L","codigo":"CL006","formula":"21","descricao":"Calço CL006 21 mm","quantidade":2},
    {"eixo":"L","codigo":"CL006","formula":"30","descricao":"Calço CL006 30 mm","quantidade":2},
    {"eixo":"L","codigo":"CL011","formula":"21","descricao":"Calço CL011 21 mm","quantidade":4},
    {"eixo":"L","codigo":"CL011","formula":"30","descricao":"Calço CL011 30 mm","quantidade":4},
    {"eixo":"L","codigo":"MP347","formula":"Largura+44","descricao":"Arremate horizontal","quantidade":1},
    {"eixo":"H","codigo":"MP347","formula":"Altura+22","descricao":"Arremate vertical","quantidade":2},
    {"eixo":"L","codigo":"SU279","formula":"Largura-4","descricao":"Marco horizontal","quantidade":1},
    {"eixo":"H","codigo":"SU279","formula":"Altura-4","descricao":"Marco vertical","quantidade":2},
    {"eixo":"L","codigo":"SU111","formula":"Largura-65","descricao":"Montante folha horizontal","quantidade":1},
    {"eixo":"H","codigo":"SU111","formula":"Altura-45","descricao":"Montante folha vertical","quantidade":2},
    {"eixo":"L","codigo":"SU225","formula":"Largura-165","descricao":"Travessa inferior","quantidade":1},
    {"eixo":"L","codigo":"SU108","formula":"Largura-165","descricao":"Travessa veneziana horizontal","quantidade":2},
    {"eixo":"H","codigo":"SU108","formula":"Altura-207","descricao":"Montante veneziana vertical","quantidade":2},
    {"eixo":"L","codigo":"VZ006","formula":"Largura-172","descricao":"Lâmina veneziana","formula_quantidade":"CEIL((Altura-197)/60)"}
  ]'::jsonb,
  '{}'::jsonb,
  '[
    {"codigo":"DOB840","formula_quantidade":"2","status":"em_validacao"},
    {"codigo":"FEC514","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"GUA239","formula_quantidade":"(Largura+2*Altura)/1000","status":"em_validacao"},
    {"codigo":"GUA282","formula_quantidade":"2*Altura/1000","status":"em_validacao"},
    {"codigo":"NYL042","formula_quantidade":"4","status":"em_validacao"},
    {"codigo":"PAR435","formula_quantidade":"4","status":"em_validacao"},
    {"codigo":"BUC755","formula_quantidade":"2*CEIL(Altura/500)+2","status":"em_validacao"},
    {"codigo":"NYL190","formula_quantidade":"2*CEIL(Altura/500)+2","status":"em_validacao"},
    {"codigo":"PAR1025","formula_quantidade":"2*CEIL(Altura/500)+2","status":"em_validacao"},
    {"codigo":"PAR1037","formula_quantidade":"2*CEIL(Altura/500)+2","status":"em_validacao"},
    {"codigo":"SIL-PU","formula_quantidade":"(Largura+2*Altura)/12000","status":"em_validacao"}
  ]'::jsonb,
  'em_validacao',
  false,
  'Referência PTA3 Suprema família B reconstruída do histórico W.Vetro. 3 linhas históricas / 3 peças sem divergências duras no comparador. Não libera produção automática.',
  jsonb_build_object(
    'origem_validacao','wvetro_comparador',
    'validacao_data','2026-10-01',
    'codigo_wvetro','SUCB-PTA-03',
    'familia','B',
    'amostras_historicas_linhas',3,
    'amostras_historicas_pecas',3,
    'comparacao_sem_divergencia_dura',true,
    'formula_ativa_existente_preservada',true,
    'liberacao_operacional',false,
    'assinatura_perfis',jsonb_build_array('CL006','CL011','MP347','SU108','SU111','SU225','SU279','VZ006'),
    'assinatura_acessorios',jsonb_build_array('BUC755','DOB840','FEC514','GUA239','GUA282','NYL042','NYL190','PAR1025','PAR1037','PAR435','SIL-PU')
  )
where not exists (
  select 1
  from public.engenharia_tipologia_formulas_corte f
  where f.tipologia_id='c7a9d371-184c-4daa-8db1-d8c60cc3f008'::uuid
    and f.configuracao_chave='pta3_suprema_familia_b_comparador'
);
