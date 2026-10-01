-- Materializa referencias tecnicas JC2 e JC3 ja cobertas pelo comparador W.Vetro.
-- Nenhuma formula e liberada operacionalmente nesta migration.
-- Registros entram em_validacao e ativo=false.

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
  'ecf93bb8-bc6f-4e1b-84eb-40f8c887485a'::uuid,
  'jc2_suprema_matriz_historica',
  'JC2-SUPREMA · referencia historica em validacao',
  '[
    {"chave":"contramarco","label":"Contramarco","opcoes":["sem","cm060"]},
    {"chave":"trilho","label":"Trilho","opcoes":["convencional","embutido"]}
  ]'::jsonb,
  '[
    {"eixo":"L","codigo":"CM060","formula":"Largura-24","descricao":"Contramarco horizontal","quantidade":2,"condicao_ativa":{"contramarco":["cm060"]}},
    {"eixo":"H","codigo":"CM060","formula":"Altura-24","descricao":"Contramarco vertical","quantidade":2,"condicao_ativa":{"contramarco":["cm060"]}},
    {"eixo":"L","codigo":"MP347","formula":"Largura+44","descricao":"Arremate interno horizontal","quantidade":2},
    {"eixo":"H","codigo":"MP347","formula":"Altura+44","descricao":"Arremate interno vertical","quantidade":2},
    {"eixo":"L","codigo":"SU001","formula":"Largura-30","descricao":"Marco superior","quantidade":1},
    {"eixo":"L","codigo":"SU002","formula":"Largura-30","descricao":"Marco inferior 2 planos","quantidade":1},
    {"eixo":"H","codigo":"SU007","formula":"Altura-4","descricao":"Marco lateral","quantidade":2},
    {"eixo":"H","codigo":"SU008","formula":"Altura-38","descricao":"Mata junta","quantidade":2},
    {"eixo":"L","codigo":"SU053","formula":"(Largura-139.6)/2","descricao":"Travessa da folha","quantidade":4},
    {"eixo":"H","codigo":"SU039","formula":"Altura-54","descricao":"Montante de folha","quantidade":2},
    {"eixo":"H","codigo":"SU040","formula":"Altura-54","descricao":"Mao-de-amigo interno","quantidade":1},
    {"eixo":"H","codigo":"SU041","formula":"Altura-54","descricao":"Mao-de-amigo externo","quantidade":1},
    {"eixo":"L","codigo":"SU102","formula":"(Largura-139.6)/2","descricao":"Baguete horizontal","quantidade":4},
    {"eixo":"H","codigo":"SU102","formula":"Altura-156","descricao":"Baguete vertical","quantidade":4}
  ]'::jsonb,
  '{"quantidade":2,"formula_largura":"FLOOR((Largura-152)/2)","formula_altura":"Altura-138"}'::jsonb,
  '[
    {"codigo":"NYL329","formula_quantidade":"1","quantidade_referencia":1,"status":"em_validacao"},
    {"codigo":"NYL335","formula_quantidade":"1","quantidade_referencia":1,"status":"em_validacao"},
    {"codigo":"NYL332","formula_quantidade":"Folhas * 4","quantidade_referencia":8,"status":"em_validacao"},
    {"codigo":"NYL414","formula_quantidade":"Folhas * 2","quantidade_referencia":4,"status":"em_validacao"},
    {"codigo":"FEC1045","formula_quantidade":"Folhas","quantidade_referencia":2,"status":"em_validacao"},
    {"codigo":"TRA009","formula_quantidade":"Folhas","quantidade_referencia":2,"status":"em_validacao"},
    {"codigo":"CON370","formula_quantidade":"Folhas","quantidade_referencia":2,"status":"em_validacao"},
    {"codigo":"ROL440","formula_quantidade":"Folhas * 2","quantidade_referencia":4,"status":"em_validacao"},
    {"codigo":"FIT206","formula_quantidade":"SU039 / 1000","status":"em_validacao"},
    {"codigo":"FIT246","formula_quantidade":"SU039 * 4 / 1000","status":"em_validacao"},
    {"codigo":"FIT212","formula_quantidade":"Largura * 4 / 1000","status":"em_validacao"},
    {"codigo":"GUA171","formula_quantidade":"SU053 * 4 / 1000","status":"em_validacao"},
    {"codigo":"GUA258","formula_quantidade":"SU039 * 4 / 1000","status":"em_validacao"},
    {"codigo":"GUA259","formula_quantidade":"GUA258 + GUA171","status":"em_validacao"},
    {"codigo":"PAR435","formula_quantidade":"Folhas * 8","quantidade_referencia":16,"status":"em_validacao"},
    {"codigo":"SIL-PU","formula_quantidade":"(Largura * 2 + Altura * 2) / 6000","status":"em_validacao"},
    {"codigo":"CHU838","quantidade_referencia":12,"status":"referencia","condicao_ativa":{"contramarco":["cm060"]}},
    {"codigo":"NYL-10005","quantidade_referencia":4,"status":"referencia","condicao_ativa":{"contramarco":["cm060"]}},
    {"codigo":"PAR1023","quantidade_referencia":8,"status":"referencia"},
    {"codigo":"NYL190","quantidade_referencia":12,"status":"referencia"},
    {"codigo":"PAR1025","quantidade_referencia":12,"status":"referencia"},
    {"codigo":"PAR1037","quantidade_referencia":12,"status":"referencia","condicao_ativa":{"contramarco":["sem"]}},
    {"codigo":"BUC755","quantidade_referencia":12,"status":"referencia","condicao_ativa":{"contramarco":["sem"]}}
  ]'::jsonb,
  'em_validacao',
  false,
  'Materializada a partir do comparador tecnico W.Vetro. 4 amostras historicas sem divergencias duras; contramarco e trilho foram inferidos corretamente. Regras de acessorios permanecem em validacao antes de liberacao operacional.',
  jsonb_build_object(
    'origem_validacao','wvetro_comparador',
    'validacao_data','2026-10-01',
    'amostras_historicas',4,
    'comparacao_sem_divergencia_dura',true,
    'opcoes_inferidas',jsonb_build_array('contramarco','trilho'),
    'liberacao_operacional',false
  )
where not exists (
  select 1
  from public.engenharia_tipologia_formulas_corte
  where tipologia_id='ecf93bb8-bc6f-4e1b-84eb-40f8c887485a'::uuid
    and configuracao_chave='jc2_suprema_matriz_historica'
);

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
  '5a37c6f1-76eb-4e26-884c-9b4fc896a953'::uuid,
  'jc3_suprema_moderna_arremate_interno',
  'JC3-SUPREMA · referencia historica moderna com arremate interno',
  '[
    {"chave":"contramarco","label":"Contramarco","opcoes":["sem","cm060","cm200"]},
    {"chave":"arremate","label":"Arremate","opcoes":["interno"]}
  ]'::jsonb,
  '[
    {"eixo":"L","codigo":"CM060","formula":"Largura-24","descricao":"Contramarco horizontal CM060","quantidade":2,"condicao_ativa":{"contramarco":["cm060"]}},
    {"eixo":"H","codigo":"CM060","formula":"Altura-24","descricao":"Contramarco vertical CM060","quantidade":2,"condicao_ativa":{"contramarco":["cm060"]}},
    {"eixo":"L","codigo":"CM200","formula":"Largura-24","descricao":"Contramarco horizontal CM200","quantidade":2,"condicao_ativa":{"contramarco":["cm200"]}},
    {"eixo":"H","codigo":"CM200","formula":"Altura-24","descricao":"Contramarco vertical CM200","quantidade":2,"condicao_ativa":{"contramarco":["cm200"]}},
    {"eixo":"L","codigo":"MP347","formula":"Largura+44","descricao":"Arremate interno horizontal","quantidade":2},
    {"eixo":"H","codigo":"MP347","formula":"Altura+44","descricao":"Arremate interno vertical","quantidade":2},
    {"eixo":"L","codigo":"SU010","formula":"Largura-30","descricao":"Marco superior","quantidade":1},
    {"eixo":"L","codigo":"SU011","formula":"Largura-30","descricao":"Marco inferior","quantidade":1},
    {"eixo":"H","codigo":"SU012","formula":"Altura-4","descricao":"Marco lateral","quantidade":2},
    {"eixo":"H","codigo":"SU008","formula":"Altura-38","descricao":"Mata-junta","quantidade":2},
    {"eixo":"H","codigo":"SU039","formula":"Altura-54","descricao":"Montante lateral","quantidade":2},
    {"eixo":"H","codigo":"SU040","formula":"Altura-54","descricao":"Mao-de-amigo interna","quantidade":2},
    {"eixo":"H","codigo":"SU041","formula":"Altura-54","descricao":"Mao-de-amigo externa","quantidade":2},
    {"eixo":"L","codigo":"SU053","formula":"(Largura-159)/3","descricao":"Travessa da folha","quantidade":6},
    {"eixo":"L","codigo":"SU102","formula":"(Largura-159)/3","descricao":"Baguete horizontal","quantidade":6},
    {"eixo":"H","codigo":"SU102","formula":"Altura-156","descricao":"Baguete vertical","quantidade":6}
  ]'::jsonb,
  '{"quantidade":3,"formula_largura":"FLOOR((Largura-178)/3)","formula_altura":"Altura-138"}'::jsonb,
  '[
    {"codigo":"NYL329","formula_quantidade":"2","quantidade_referencia":2,"status":"em_validacao"},
    {"codigo":"NYL335","formula_quantidade":"Folhas-1","quantidade_referencia":2,"status":"em_validacao"},
    {"codigo":"NYL332","formula_quantidade":"Folhas*4","quantidade_referencia":12,"status":"em_validacao"},
    {"codigo":"NYL414","formula_quantidade":"4*(Folhas-1)","quantidade_referencia":8,"status":"em_validacao"},
    {"codigo":"CON370","formula_quantidade":"2","quantidade_referencia":2,"status":"em_validacao"},
    {"codigo":"FEC1045","formula_quantidade":"2","quantidade_referencia":2,"status":"em_validacao"},
    {"codigo":"ROL440","formula_quantidade":"Folhas*2","quantidade_referencia":6,"status":"em_validacao"},
    {"codigo":"TRA009","formula_quantidade":"2","quantidade_referencia":2,"status":"em_validacao"},
    {"codigo":"FIT206","formula_quantidade":"Altura*2/1000","status":"em_validacao"},
    {"codigo":"FIT246","formula_quantidade":"Altura*4/1000","status":"em_validacao"},
    {"codigo":"FIT212","formula_quantidade":"Largura*4/1000","status":"em_validacao"},
    {"codigo":"GUA171","formula_quantidade":"Largura*2/1000","status":"em_validacao"},
    {"codigo":"GUA258","formula_quantidade":"Altura*6/1000","status":"em_validacao"},
    {"codigo":"GUA259","formula_quantidade":"GUA171+GUA258","status":"em_validacao"},
    {"codigo":"PAR435","formula_quantidade":"Folhas*8","quantidade_referencia":24,"status":"em_validacao"},
    {"codigo":"SIL-PU","formula_quantidade":"(Largura*2+Altura*2)/6000","status":"em_validacao"},
    {"codigo":"PAR1023","quantidade_referencia":6,"status":"referencia"},
    {"codigo":"NYL190","quantidade_referencia":14,"status":"referencia"},
    {"codigo":"PAR1025","quantidade_referencia":14,"status":"referencia"},
    {"codigo":"PAR1037","quantidade_referencia":16,"status":"referencia","condicao_ativa":{"contramarco":["sem"]}},
    {"codigo":"BUC755","quantidade_referencia":16,"status":"referencia","condicao_ativa":{"contramarco":["sem"]}},
    {"codigo":"CHU838","quantidade_referencia":14,"status":"referencia","condicao_ativa":{"contramarco":["cm060","cm200"]}},
    {"codigo":"NYL-10002","quantidade_referencia":4,"status":"referencia","condicao_ativa":{"contramarco":["cm200"]}},
    {"codigo":"NYL-10005","quantidade_referencia":4,"status":"referencia","condicao_ativa":{"contramarco":["cm060"]}}
  ]'::jsonb,
  'em_validacao',
  false,
  'Materializada a partir do comparador tecnico W.Vetro. 5 amostras historicas modernas sem divergencias duras; todas apresentaram 5 regras pendentes de acessorios. Contramarco e arremate foram inferidos corretamente.',
  jsonb_build_object(
    'origem_validacao','wvetro_comparador',
    'validacao_data','2026-10-01',
    'amostras_historicas',5,
    'comparacao_sem_divergencia_dura',true,
    'regra_pendente_atlas',5,
    'opcoes_inferidas',jsonb_build_array('contramarco','arremate'),
    'liberacao_operacional',false
  )
where not exists (
  select 1
  from public.engenharia_tipologia_formulas_corte
  where tipologia_id='5a37c6f1-76eb-4e26-884c-9b4fc896a953'::uuid
    and configuracao_chave='jc3_suprema_moderna_arremate_interno'
);
