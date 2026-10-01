-- Materializa referencias tecnicas PG1 e BAS3 ja cobertas pelo comparador W.Vetro.
-- Nenhuma formula e liberada operacionalmente nesta migration.
-- Todos os registros entram como em_validacao e ativo=false.

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
  '37a87c58-2bd6-49d0-bfa2-61e3a4d7d051'::uuid,
  'pg1_suprema_lambril_sem_contramarco',
  'PG1-SUPREMA · Lambril · sem contramarco · referencia historica',
  '[]'::jsonb,
  '[
    {"eixo":"L","codigo":"MP347","formula":"Largura+44","descricao":"Arremate interno horizontal","quantidade":1},
    {"eixo":"H","codigo":"MP347","formula":"Altura+22","descricao":"Arremate interno vertical","quantidade":2},
    {"eixo":"L","codigo":"SU279","formula":"Largura-4","descricao":"Marco horizontal","quantidade":1},
    {"eixo":"H","codigo":"SU279","formula":"Altura-4","descricao":"Marco vertical","quantidade":2},
    {"eixo":"L","codigo":"SU111","formula":"Largura-72","descricao":"Montante folha de giro horizontal","quantidade":1},
    {"eixo":"H","codigo":"SU111","formula":"Altura-49","descricao":"Montante folha de giro vertical","quantidade":2},
    {"eixo":"L","codigo":"SU225","formula":"Largura-172","descricao":"Travessa inferior da folha","quantidade":1},
    {"eixo":"L","codigo":"SU102","formula":"Largura-172","descricao":"Baguete horizontal","quantidade":2},
    {"eixo":"H","codigo":"SU102","formula":"Altura-211","descricao":"Baguete vertical","quantidade":2},
    {"eixo":"L","codigo":"GS-034","formula":"Largura-173","descricao":"Lambril duplo horizontal","formula_quantidade":"CEIL((Altura-28)/108.2)"},
    {"eixo":"L","codigo":"25-548 (L-715)","formula":"Largura-53","descricao":"Complemento folha horizontal","quantidade":1},
    {"eixo":"H","codigo":"25-548 (L-715)","formula":"Altura-30","descricao":"Complemento folha vertical","quantidade":1}
  ]'::jsonb,
  '{}'::jsonb,
  '[
    {"codigo":"GUA239","formula_quantidade":"(Largura + Altura * 2) / 1000","status":"em_validacao"},
    {"codigo":"PAR435","formula_quantidade":"4","status":"em_validacao"},
    {"codigo":"NYL042","formula_quantidade":"2","status":"em_validacao"},
    {"codigo":"REBACA4X10","quantidade_referencia":8,"status":"referencia"},
    {"codigo":"FIT206","formula_quantidade":"(Largura + Altura) / 1000","status":"em_validacao"},
    {"codigo":"DOB840","formula_quantidade":"3","status":"em_validacao"},
    {"codigo":"FRA822","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"CON295","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"MAC927","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"GUA258","formula_quantidade":"Altura * 2 / 1000","status":"em_validacao"},
    {"codigo":"NYL190","formula_quantidade":"12","status":"em_validacao"},
    {"codigo":"PAR1025","formula_quantidade":"12","status":"em_validacao"},
    {"codigo":"PAR1037","formula_quantidade":"12","status":"em_validacao"},
    {"codigo":"BUC755","formula_quantidade":"12","status":"em_validacao"},
    {"codigo":"SIL-PU","formula_quantidade":"(Largura + Altura * 2) / 12000","status":"em_validacao"},
    {"codigo":"ALMC25","formula_quantidade":"2","status":"em_validacao"},
    {"codigo":"ALMC2960","formula_quantidade":"2","status":"em_validacao"}
  ]'::jsonb,
  'em_validacao',
  false,
  'Materializada a partir do comparador tecnico W.Vetro. 4 amostras historicas sem divergencias duras. Permanece 1 regra pendente: REBACA4X10.',
  jsonb_build_object(
    'origem_validacao','wvetro_comparador',
    'validacao_data','2026-10-01',
    'amostras_historicas',4,
    'comparacao_sem_divergencia_dura',true,
    'regra_pendente_atlas',1,
    'liberacao_operacional',false
  )
where not exists (
  select 1
  from public.engenharia_tipologia_formulas_corte
  where tipologia_id='37a87c58-2bd6-49d0-bfa2-61e3a4d7d051'::uuid
    and configuracao_chave='pg1_suprema_lambril_sem_contramarco'
);

insert into public.engenharia_tipologia_formulas_corte (
  tipologia_id,configuracao_chave,configuracao_label,variaveis,pecas,vidro,acessorios,status,ativo,observacoes,metadados_editor
)
select
  '37a87c58-2bd6-49d0-bfa2-61e3a4d7d051'::uuid,
  'pg1_suprema_vidro_arremate_interno',
  'PG1-SUPREMA · Vidro · arremate interno · kit unitario · referencia historica dominante',
  '[]'::jsonb,
  '[
    {"eixo":"L","codigo":"MP347","formula":"Largura+44","descricao":"Arremate interno horizontal","quantidade":1},
    {"eixo":"H","codigo":"MP347","formula":"Altura+22","descricao":"Arremate interno vertical","quantidade":2},
    {"eixo":"L","codigo":"SU279","formula":"Largura-4","descricao":"Marco horizontal","quantidade":1},
    {"eixo":"H","codigo":"SU279","formula":"Altura-4","descricao":"Marco vertical","quantidade":2},
    {"eixo":"L","codigo":"SU111","formula":"Largura-72","descricao":"Montante folha de giro horizontal","quantidade":1},
    {"eixo":"H","codigo":"SU111","formula":"Altura-49","descricao":"Montante folha de giro vertical","quantidade":2},
    {"eixo":"L","codigo":"SU225","formula":"Largura-172","descricao":"Travessa inferior da folha","quantidade":1},
    {"eixo":"L","codigo":"SU102","formula":"Largura-172","descricao":"Baguete horizontal","quantidade":2},
    {"eixo":"H","codigo":"SU102","formula":"Altura-211","descricao":"Baguete vertical","quantidade":2},
    {"eixo":"L","codigo":"25-548 (L-715)","formula":"Largura-53","descricao":"Complemento folha horizontal","quantidade":1},
    {"eixo":"H","codigo":"25-548 (L-715)","formula":"Altura-30","descricao":"Complemento folha vertical","quantidade":1}
  ]'::jsonb,
  '{"quantidade":1,"formula_largura":"Largura-178","formula_altura":"Altura-193"}'::jsonb,
  '[
    {"codigo":"ALMC25","formula_quantidade":"2","status":"em_validacao"},
    {"codigo":"ALMC2960","formula_quantidade":"2","status":"em_validacao"},
    {"codigo":"CON295","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"FRA822","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"MAC927","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"NYL042","formula_quantidade":"2","status":"em_validacao"},
    {"codigo":"PAR435","formula_quantidade":"4","status":"em_validacao"},
    {"codigo":"FIT206","formula_quantidade":"(Largura+Altura)/1000","status":"em_validacao"},
    {"codigo":"GUA171","formula_quantidade":"Largura/1000","status":"em_validacao"},
    {"codigo":"GUA239","formula_quantidade":"(Largura+2*Altura)/1000","status":"em_validacao"},
    {"codigo":"GUA258","formula_quantidade":"(Largura+2*Altura)/1000","status":"em_validacao"},
    {"codigo":"GUA259","formula_quantidade":"(2*Largura+2*Altura)/1000","status":"em_validacao"},
    {"codigo":"SIL-PU","formula_quantidade":"(Largura+2*Altura)/12000","status":"em_validacao"},
    {"codigo":"DOB840","quantidade_referencia":3,"status":"referencia"},
    {"codigo":"BUC755","quantidade_referencia":12,"status":"referencia"},
    {"codigo":"NYL190","quantidade_referencia":12,"status":"referencia"},
    {"codigo":"PAR1025","quantidade_referencia":12,"status":"referencia"},
    {"codigo":"PAR1037","quantidade_referencia":12,"status":"referencia"},
    {"codigo":"REBACA4X10","quantidade_referencia":8,"status":"referencia"}
  ]'::jsonb,
  'em_validacao',
  false,
  'Materializada a partir do comparador tecnico W.Vetro. 5 amostras historicas sem divergencias duras. Permanecem 6 regras pendentes de acessorios.',
  jsonb_build_object(
    'origem_validacao','wvetro_comparador',
    'validacao_data','2026-10-01',
    'amostras_historicas',5,
    'comparacao_sem_divergencia_dura',true,
    'regra_pendente_atlas',6,
    'liberacao_operacional',false
  )
where not exists (
  select 1 from public.engenharia_tipologia_formulas_corte
  where tipologia_id='37a87c58-2bd6-49d0-bfa2-61e3a4d7d051'::uuid
    and configuracao_chave='pg1_suprema_vidro_arremate_interno'
);

insert into public.engenharia_tipologia_formulas_corte (
  tipologia_id,configuracao_chave,configuracao_label,variaveis,pecas,vidro,acessorios,status,ativo,observacoes,metadados_editor
)
select
  '37a87c58-2bd6-49d0-bfa2-61e3a4d7d051'::uuid,
  'pg1_suprema_vidro_sem_arremate',
  'PG1-SUPREMA · Vidro · sem arremate/contramarco · kit unitario · referencia historica',
  '[]'::jsonb,
  '[
    {"eixo":"L","codigo":"SU279","formula":"Largura-4","descricao":"Marco horizontal","quantidade":1},
    {"eixo":"H","codigo":"SU279","formula":"Altura-4","descricao":"Marco vertical","quantidade":2},
    {"eixo":"L","codigo":"SU111","formula":"Largura-72","descricao":"Montante folha de giro horizontal","quantidade":1},
    {"eixo":"H","codigo":"SU111","formula":"Altura-49","descricao":"Montante folha de giro vertical","quantidade":2},
    {"eixo":"L","codigo":"SU225","formula":"Largura-172","descricao":"Travessa inferior da folha","quantidade":1},
    {"eixo":"L","codigo":"SU102","formula":"Largura-172","descricao":"Baguete horizontal","quantidade":2},
    {"eixo":"H","codigo":"SU102","formula":"Altura-211","descricao":"Baguete vertical","quantidade":2},
    {"eixo":"L","codigo":"25-548 (L-715)","formula":"Largura-53","descricao":"Complemento folha horizontal","quantidade":1},
    {"eixo":"H","codigo":"25-548 (L-715)","formula":"Altura-30","descricao":"Complemento folha vertical","quantidade":1}
  ]'::jsonb,
  '{"quantidade":1,"formula_largura":"Largura-178","formula_altura":"Altura-193"}'::jsonb,
  '[
    {"codigo":"ALMC25","formula_quantidade":"2","status":"em_validacao"},
    {"codigo":"ALMC2960","formula_quantidade":"2","status":"em_validacao"},
    {"codigo":"CON295","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"DOB840","formula_quantidade":"3","status":"em_validacao"},
    {"codigo":"FRA822","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"MAC927","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"NYL042","formula_quantidade":"2","status":"em_validacao"},
    {"codigo":"PAR435","formula_quantidade":"4","status":"em_validacao"},
    {"codigo":"FIT206","formula_quantidade":"(Largura+Altura)/1000","status":"em_validacao"},
    {"codigo":"GUA171","formula_quantidade":"Largura/1000","status":"em_validacao"},
    {"codigo":"GUA239","formula_quantidade":"(Largura+2*Altura)/1000","status":"em_validacao"},
    {"codigo":"GUA258","formula_quantidade":"(Largura+2*Altura)/1000","status":"em_validacao"},
    {"codigo":"GUA259","formula_quantidade":"(2*Largura+2*Altura)/1000","status":"em_validacao"},
    {"codigo":"SIL-PU","formula_quantidade":"(Largura+2*Altura)/12000","status":"em_validacao"},
    {"codigo":"BUC755","quantidade_referencia":12,"status":"referencia"},
    {"codigo":"PAR1037","quantidade_referencia":12,"status":"referencia"},
    {"codigo":"REBACA4X10","quantidade_referencia":8,"status":"referencia"}
  ]'::jsonb,
  'em_validacao',
  false,
  'Materializada a partir do comparador tecnico W.Vetro. 5 amostras historicas sem divergencias duras. Permanecem 3 regras pendentes de acessorios.',
  jsonb_build_object(
    'origem_validacao','wvetro_comparador',
    'validacao_data','2026-10-01',
    'amostras_historicas',5,
    'comparacao_sem_divergencia_dura',true,
    'regra_pendente_atlas',3,
    'liberacao_operacional',false
  )
where not exists (
  select 1 from public.engenharia_tipologia_formulas_corte
  where tipologia_id='37a87c58-2bd6-49d0-bfa2-61e3a4d7d051'::uuid
    and configuracao_chave='pg1_suprema_vidro_sem_arremate'
);

insert into public.engenharia_tipologia_formulas_corte (
  tipologia_id,configuracao_chave,configuracao_label,variaveis,pecas,vidro,acessorios,status,ativo,observacoes,metadados_editor
)
select
  '2a3384fd-a47f-4ea6-846a-610da8c9dab2'::uuid,
  'bas3_suprema_dominante',
  'BAS3-SUPREMA · Basculante · composicao dominante · referencia historica',
  '[]'::jsonb,
  '[
    {"codigo":"CL006","formula":"22","descricao":"Calco auxiliar CL006","quantidade":8},
    {"codigo":"CL011","formula":"22","descricao":"Calco auxiliar CL011","quantidade":16},
    {"codigo":"BC-009","formula":"16","descricao":"Componente auxiliar BC-009","quantidade":2},
    {"eixo":"L","codigo":"MP347","formula":"Largura+44","descricao":"Arremate interno horizontal","quantidade":2},
    {"eixo":"H","codigo":"MP347","formula":"Altura+44","descricao":"Arremate interno vertical","quantidade":2},
    {"eixo":"L","codigo":"SU093","formula":"Largura-4","descricao":"Marco horizontal","quantidade":2},
    {"eixo":"H","codigo":"SU093","formula":"Altura-4","descricao":"Marco vertical","quantidade":2},
    {"eixo":"H","codigo":"SU096","formula":"Altura-72.8","descricao":"Montante basculante","quantidade":2},
    {"eixo":"L","codigo":"SU097","formula":"Largura-51","descricao":"Travessa superior","quantidade":1},
    {"eixo":"L","codigo":"SU098","formula":"Largura-51","descricao":"Travessa inferior","quantidade":1},
    {"eixo":"L","codigo":"SU100","formula":"Largura-51","descricao":"Travessa interna horizontal","quantidade":2},
    {"eixo":"H","codigo":"SU100","formula":"Altura/2-35.5","descricao":"Travessa interna vertical","quantidade":8},
    {"eixo":"L","codigo":"SU102","formula":"Largura-104","descricao":"Baguete horizontal","quantidade":2},
    {"eixo":"H","codigo":"SU102","formula":"Altura-125.8","descricao":"Baguete vertical","quantidade":2},
    {"eixo":"H","codigo":"AF-018","formula":"Altura-125.8","descricao":"Perfil auxiliar AF-018","quantidade":2}
  ]'::jsonb,
  '{"quantidade":1,"formula_largura":"Largura-110","formula_altura":"Altura-108"}'::jsonb,
  '[
    {"codigo":"ALA-059","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"ARR-10001","formula_quantidade":"6","status":"em_validacao"},
    {"codigo":"CON456","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"PIV753","formula_quantidade":"2","status":"em_validacao"},
    {"codigo":"GUA171","formula_quantidade":"2*(Largura+Altura)/1000","status":"em_validacao"},
    {"codigo":"GUA259","formula_quantidade":"2*(Largura+Altura)/1000","status":"em_validacao"},
    {"codigo":"SIL-PU","formula_quantidade":"2*(Largura+Altura)/12000","status":"em_validacao"},
    {"codigo":"BUC753","quantidade_referencia":10,"status":"referencia"},
    {"codigo":"NYL190","quantidade_referencia":10,"status":"referencia"},
    {"codigo":"PARFIAPF04850N","quantidade_referencia":10,"status":"referencia"},
    {"codigo":"PARFIAPP04216N","quantidade_referencia":10,"status":"referencia"},
    {"codigo":"REBACA4X10","quantidade_referencia":18,"status":"referencia"},
    {"codigo":"REBCCC-5/32X1/2","quantidade_referencia":2,"status":"referencia"}
  ]'::jsonb,
  'em_validacao',
  false,
  'Materializada a partir do comparador tecnico W.Vetro. 5 amostras historicas sem divergencias duras. Permanecem 6 regras pendentes de acessorios.',
  jsonb_build_object(
    'origem_validacao','wvetro_comparador',
    'validacao_data','2026-10-01',
    'amostras_historicas',5,
    'comparacao_sem_divergencia_dura',true,
    'regra_pendente_atlas',6,
    'liberacao_operacional',false
  )
where not exists (
  select 1 from public.engenharia_tipologia_formulas_corte
  where tipologia_id='2a3384fd-a47f-4ea6-846a-610da8c9dab2'::uuid
    and configuracao_chave='bas3_suprema_dominante'
);
