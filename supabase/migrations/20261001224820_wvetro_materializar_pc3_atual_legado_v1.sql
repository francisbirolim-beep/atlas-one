-- Materializa duas referências históricas PC3 Suprema já validadas pelo comparador W.Vetro.
-- Preserva a fórmula ativa existente: estas referências entram apenas para rastreabilidade técnica.
-- Nenhuma das duas é liberada operacionalmente nesta migration.

with referencias as (
  select *
  from (
    values
      (
        'atual_17'::text,
        'pc3_suprema_atual_17_comparador'::text,
        'PC3-SUPREMA · referência histórica atual (SU008 -17)'::text,
        'Altura-17'::text,
        'Altura-29'::text,
        3::int,
        '[3,5,5]'::jsonb
      ),
      (
        'legado_21'::text,
        'pc3_suprema_legado_21_comparador'::text,
        'PC3-SUPREMA · referência histórica legada (SU008 -21)'::text,
        'Altura-21'::text,
        'Altura-33'::text,
        1::int,
        '[5]'::jsonb
      )
  ) as r(
    versao_mata_junta,
    configuracao_chave,
    configuracao_label,
    formula_su008_sem_cm,
    formula_su008_cm200,
    amostras_historicas,
    pendencias_por_amostra
  )
)
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
  'dce9da1d-7e03-4c1c-ad1b-2f101b51a52e'::uuid,
  r.configuracao_chave,
  r.configuracao_label,
  jsonb_build_array(
    jsonb_build_object(
      'chave','contramarco',
      'label','Contramarco',
      'opcoes',jsonb_build_array('sem','cm200')
    ),
    jsonb_build_object(
      'chave','arremate',
      'label','Arremate',
      'opcoes',jsonb_build_array('sem','interno')
    ),
    jsonb_build_object(
      'chave','versao_mata_junta',
      'label','Versão histórica do mata-junta',
      'opcoes',jsonb_build_array(r.versao_mata_junta)
    )
  ),
  '[
    {"eixo":"L","codigo":"CM200","formula":"Largura-48","descricao":"Contramarco horizontal","quantidade":1,"condicao_ativa":{"contramarco":["cm200"]}},
    {"eixo":"H","codigo":"CM200","formula":"Altura-24","descricao":"Contramarco vertical","quantidade":2,"condicao_ativa":{"contramarco":["cm200"]}},
    {"eixo":"L","codigo":"MP347","formula":"Largura+44","descricao":"Arremate interno horizontal","quantidade":1,"condicao_ativa":{"arremate":["interno"]},"condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Largura+20"}]},
    {"eixo":"H","codigo":"MP347","formula":"Altura+22","descricao":"Arremate interno vertical","quantidade":2,"condicao_ativa":{"arremate":["interno"]},"condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Altura+10"}]},
    {"eixo":"L","codigo":"SU010","formula":"Largura-30","descricao":"Marco superior / correr 3","quantidade":1,"condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Largura-54"}]},
    {"eixo":"L","codigo":"TMC","formula":"Largura-30","descricao":"Trilho macarrão","quantidade":3,"condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Largura-54"}]},
    {"eixo":"H","codigo":"SU012","formula":"Altura-4","descricao":"Marco lateral / correr 3","quantidade":2,"condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Altura-16"}]}
  ]'::jsonb
  ||
  jsonb_build_array(
    jsonb_build_object(
      'eixo','H',
      'codigo','SU008',
      'formula',r.formula_su008_sem_cm,
      'descricao','Mata-junta / complemento do marco',
      'quantidade',2,
      'condicoes',jsonb_build_array(
        jsonb_build_object(
          'quando',jsonb_build_object('contramarco',jsonb_build_array('cm200')),
          'formula',r.formula_su008_cm200
        )
      )
    )
  )
  ||
  '[
    {"eixo":"L","codigo":"SU053","formula":"(Largura-184.4)/3","descricao":"Travessa superior da folha","quantidade":3,"condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"(Largura-208.4)/3"}]},
    {"eixo":"L","codigo":"SU225","formula":"(Largura-184.4)/3","descricao":"Travessa inferior da folha","quantidade":3,"condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"(Largura-208.4)/3"}]},
    {"eixo":"H","codigo":"SU280","formula":"Altura-34","descricao":"Montante lateral da folha","quantidade":2,"condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Altura-46"}]},
    {"eixo":"H","codigo":"SU040","formula":"Altura-34","descricao":"Mão-de-amigo interna","quantidade":2,"condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Altura-46"}]},
    {"eixo":"H","codigo":"SU041","formula":"Altura-34","descricao":"Mão-de-amigo externa","quantidade":2,"condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Altura-46"}]},
    {"eixo":"L","codigo":"SU102","formula":"(Largura-184.4)/3","descricao":"Baguete horizontal","quantidade":6,"condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"(Largura-208.4)/3"}]},
    {"eixo":"H","codigo":"SU102","formula":"Altura-185","descricao":"Baguete vertical","quantidade":6,"condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Altura-197"}]}
  ]'::jsonb,
  jsonb_build_object(
    'quantidade',3,
    'formula_largura','FLOOR((Largura-203)/3)',
    'formula_altura','Altura-167',
    'condicoes_largura',jsonb_build_array(
      jsonb_build_object(
        'quando',jsonb_build_object('contramarco',jsonb_build_array('cm200')),
        'formula','FLOOR((Largura-227)/3)'
      )
    ),
    'condicoes_altura',jsonb_build_array(
      jsonb_build_object(
        'quando',jsonb_build_object('contramarco',jsonb_build_array('cm200')),
        'formula','Altura-179'
      )
    )
  ),
  '[
    {"codigo":"NYL335","formula_quantidade":"Folhas-1","quantidade_referencia":2,"status":"em_validacao"},
    {"codigo":"NYL332","formula_quantidade":"Folhas*4","quantidade_referencia":12,"status":"em_validacao"},
    {"codigo":"NYL414","formula_quantidade":"4*(Folhas-1)","quantidade_referencia":8,"status":"em_validacao"},
    {"codigo":"FRA820","formula_quantidade":"2","quantidade_referencia":2,"status":"em_validacao"},
    {"codigo":"CON409","formula_quantidade":"2","quantidade_referencia":2,"status":"em_validacao"},
    {"codigo":"RPCS100","formula_quantidade":"Folhas*2","quantidade_referencia":6,"status":"em_validacao"},
    {"codigo":"FIT206","formula_quantidade":"SU040*2/1000","status":"em_validacao"},
    {"codigo":"FIT246","formula_quantidade":"SU040*4/1000","status":"em_validacao"},
    {"codigo":"FIT212","formula_quantidade":"Largura*4/1000","status":"em_validacao","condicao_ativa":{"contramarco":["sem"]}},
    {"codigo":"FIT212","formula_quantidade":"(Largura-24)*4/1000","status":"em_validacao","condicao_ativa":{"contramarco":["cm200"]}},
    {"codigo":"GUA171","formula_quantidade":"SU053*6/1000","status":"em_validacao"},
    {"codigo":"GUA258","formula_quantidade":"SU040*6/1000","status":"em_validacao"},
    {"codigo":"GUA259","formula_quantidade":"GUA258+GUA171","status":"em_validacao"},
    {"codigo":"PAR435","formula_quantidade":"Folhas*8","quantidade_referencia":24,"status":"em_validacao"},
    {"codigo":"NYL042","formula_quantidade":"Folhas*4","quantidade_referencia":12,"status":"em_validacao"},
    {"codigo":"SIL-PU","formula_quantidade":"(Largura*2+Altura*2)/6000","status":"em_validacao","condicao_ativa":{"contramarco":["sem"]}},
    {"codigo":"SIL-PU","formula_quantidade":"((Largura-24)*2+(Altura-24)*2)/6000","status":"em_validacao","condicao_ativa":{"contramarco":["cm200"]}},
    {"codigo":"PAR1023","quantidade_referencia":12,"status":"referencia"},
    {"codigo":"NYL190","quantidade_referencia":15,"status":"referencia","condicao_ativa":{"arremate":["interno"]}},
    {"codigo":"PAR1025","quantidade_referencia":15,"status":"referencia","condicao_ativa":{"arremate":["interno"]}},
    {"codigo":"PAR1037","quantidade_referencia":14,"status":"referencia","condicao_ativa":{"contramarco":["sem"]}},
    {"codigo":"BUC755","quantidade_referencia":14,"status":"referencia","condicao_ativa":{"contramarco":["sem"]}},
    {"codigo":"CHU838","quantidade_referencia":15,"status":"referencia","condicao_ativa":{"contramarco":["cm200"]}},
    {"codigo":"NYL-10002","quantidade_referencia":2,"status":"referencia","condicao_ativa":{"contramarco":["cm200"]}}
  ]'::jsonb,
  'em_validacao',
  false,
  case
    when r.versao_mata_junta = 'atual_17'
      then 'Referência PC3 atual materializada a partir do comparador W.Vetro. 3 amostras atuais sem divergências duras; pendências observadas por amostra: 3, 5 e 5. A fórmula ativa existente não foi alterada.'
    else 'Referência PC3 legada materializada a partir do comparador W.Vetro. 1 amostra legada sem divergências duras e com 5 regras pendentes. A fórmula ativa existente não foi alterada.'
  end,
  jsonb_build_object(
    'origem_validacao','wvetro_comparador',
    'validacao_data','2026-10-01',
    'versao_mata_junta',r.versao_mata_junta,
    'amostras_historicas',r.amostras_historicas,
    'pendencias_por_amostra',r.pendencias_por_amostra,
    'comparacao_sem_divergencia_dura',true,
    'formula_ativa_existente_preservada',true,
    'liberacao_operacional',false
  )
from referencias r
where not exists (
  select 1
  from public.engenharia_tipologia_formulas_corte f
  where f.tipologia_id='dce9da1d-7e03-4c1c-ad1b-2f101b51a52e'::uuid
    and f.configuracao_chave=r.configuracao_chave
);
