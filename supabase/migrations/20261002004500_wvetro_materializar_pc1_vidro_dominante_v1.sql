-- Materializa a referência histórica dominante PC1 Suprema com vidro.
-- Evidência: 14 itens históricos com a mesma assinatura técnica.
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
  'e2f2809c-1f44-4261-a1a5-4c506da35315'::uuid,
  'pc1_suprema_vidro_dominante_comparador',
  'PC1-SUPREMA · vidro · composição dominante · referência histórica',
  '[]'::jsonb,
  '[
    {"eixo":"L","codigo":"SU008","formula":"Altura","descricao":"Mata-junta / complemento","quantidade":1},
    {"eixo":"H","codigo":"SU039","formula":"Altura-21","descricao":"Montante da folha","quantidade":2},
    {"eixo":"L","codigo":"SU053","formula":"Largura-35.4","descricao":"Travessa superior","quantidade":1},
    {"eixo":"L","codigo":"SU102","formula":"Largura-35.4","descricao":"Baguete horizontal","quantidade":2},
    {"eixo":"H","codigo":"SU102","formula":"Altura-172","descricao":"Baguete vertical","quantidade":2},
    {"eixo":"L","codigo":"SU107","formula":"21","descricao":"Calço/complemento 21 mm","quantidade":4},
    {"eixo":"L","codigo":"SU225","formula":"Largura-35.4","descricao":"Travessa inferior","quantidade":1},
    {"eixo":"L","codigo":"SU271","formula":"2*Largura+52.6","descricao":"Trilho/marco horizontal","quantidade":1},
    {"eixo":"H","codigo":"T-214","formula":"Altura-21","descricao":"Complemento T vertical","quantidade":1},
    {"eixo":"L","codigo":"TMC","formula":"2*Largura+52.6","descricao":"Trilho macarrão","quantidade":1},
    {"eixo":"H","codigo":"TQ017","formula":"Altura","descricao":"Estrutura tubular vertical","quantidade":2},
    {"eixo":"L","codigo":"TQ017","formula":"2*Largura+154.2","descricao":"Estrutura tubular horizontal","quantidade":1}
  ]'::jsonb,
  '{"quantidade":1,"formula_largura":"Largura-42","formula_altura":"Altura-154"}'::jsonb,
  '[
    {"codigo":"BATLIMR28","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"BUC755","quantidade_referencia":24,"status":"referencia"},
    {"codigo":"CON382","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"FIT206","formula_quantidade":"(Altura-21)/1000","status":"em_validacao"},
    {"codigo":"FIT212","formula_quantidade":"4*(Largura-35.4)/1000","status":"em_validacao"},
    {"codigo":"FIT214","formula_quantidade":"2*Altura/1000","status":"em_validacao"},
    {"codigo":"FRA820","formula_quantidade":"1","status":"em_validacao"},
    {"codigo":"GUA171","formula_quantidade":"2*(Largura-35.4)/1000","status":"em_validacao"},
    {"codigo":"GUA258","formula_quantidade":"2*(Altura-172)/1000","status":"em_validacao"},
    {"codigo":"GUA259","formula_quantidade":"2*(Largura-35.4)/1000 + 2*(Altura-172)/1000","status":"em_validacao"},
    {"codigo":"NYL042","formula_quantidade":"2","status":"em_validacao"},
    {"codigo":"NYL332","formula_quantidade":"4","status":"em_validacao"},
    {"codigo":"PAR1023","formula_quantidade":"7","status":"em_validacao"},
    {"codigo":"PAR1037","quantidade_referencia":24,"status":"referencia"},
    {"codigo":"PAR435","formula_quantidade":"6","status":"em_validacao"},
    {"codigo":"PUX006","formula_quantidade":"2","status":"em_validacao"},
    {"codigo":"REBACA4X10","formula_quantidade":"16","status":"em_validacao"},
    {"codigo":"RPCS100","formula_quantidade":"4","status":"em_validacao"},
    {"codigo":"SIL-PU","formula_quantidade":"(Largura+Altura)/6000","status":"em_validacao"}
  ]'::jsonb,
  'em_validacao',
  false,
  'Referência PC1 Suprema vidro reconstruída de 14 itens históricos W.Vetro com assinatura dominante. Seis medidas representativas passaram na regressão técnica sem divergências duras. BUC755 e PAR1037 permanecem como regras pendentes de espaçamento. Não libera produção automática.',
  jsonb_build_object(
    'origem_validacao','wvetro_comparador',
    'validacao_data','2026-10-01',
    'codigo_wvetro','SUCB-PC1-01',
    'familia','vidro',
    'amostras_historicas_assinatura',14,
    'amostras_regressao',6,
    'comparacao_sem_divergencia_dura',true,
    'regra_pendente_atlas',2,
    'regras_pendentes',jsonb_build_array('BUC755','PAR1037'),
    'comparacao_aprovada',false,
    'liberacao_operacional',false,
    'assinatura_perfis',jsonb_build_array(
      'SU008','SU039','SU053','SU102','SU107','SU225','SU271','T-214','TMC','TQ017'
    ),
    'assinatura_acessorios',jsonb_build_array(
      'BATLIMR28','BUC755','CON382','FIT206','FIT212','FIT214','FRA820','GUA171',
      'GUA258','GUA259','NYL042','NYL332','PAR1023','PAR1037','PAR435','PUX006',
      'REBACA4X10','RPCS100','SIL-PU'
    )
  )
where not exists (
  select 1
  from public.engenharia_tipologia_formulas_corte f
  where f.tipologia_id='e2f2809c-1f44-4261-a1a5-4c506da35315'::uuid
    and f.configuracao_chave='pc1_suprema_vidro_dominante_comparador'
);
