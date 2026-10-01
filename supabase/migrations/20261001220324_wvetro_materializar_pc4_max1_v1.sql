-- Materializa evidências técnicas já cobertas pelo comparador W.Vetro.
-- Não libera novas fórmulas no Plano de Corte: ambas permanecem inativas nesta migration.

update public.engenharia_tipologia_formulas_corte
set
  configuracao_label = 'PC4 Suprema · 4 móveis em 4 planos · mão-amiga comum · com vidro',
  variaveis = '[]'::jsonb,
  pecas = '[{"eixo":"L","codigo":"MP347","formula":"LF + 48","descricao":"Arremate interno horizontal","quantidade":1},{"eixo":"H","codigo":"MP347","formula":"HF + 26","descricao":"Arremate interno vertical","quantidade":2},{"eixo":"L","codigo":"SU121","formula":"LF - 26","descricao":"Marco superior / correr 4","quantidade":1},{"eixo":"L","codigo":"TMC","formula":"LF - 26","descricao":"Trilho macarrão embutido","quantidade":4},{"eixo":"H","codigo":"SU123","formula":"HF","descricao":"Marco lateral / correr 4","quantidade":2},{"eixo":"H","codigo":"SU008","formula":"HF - 13","descricao":"Mata-junta / complemento do marco","quantidade":2},{"eixo":"L","codigo":"SU053","formula":"(LF - 198.8) / 4","descricao":"Travessa superior da folha","quantidade":4},{"eixo":"L","codigo":"SU225","formula":"(LF - 198.8) / 4","descricao":"Travessa inferior da folha","quantidade":4},{"eixo":"H","codigo":"SU280","formula":"HF - 30","descricao":"Montante lateral com reforço de aba","quantidade":2},{"eixo":"H","codigo":"SU040","formula":"HF - 30","descricao":"Mão-amiga interna comum","quantidade":3},{"eixo":"H","codigo":"SU041","formula":"HF - 30","descricao":"Mão-amiga externa comum","quantidade":3},{"eixo":"L","codigo":"SU102","formula":"(LF - 198.8) / 4","descricao":"Baguete horizontal","quantidade":8},{"eixo":"H","codigo":"SU102","formula":"HF - 181","descricao":"Baguete vertical","quantidade":8}]'::jsonb,
  vidro = '{"quantidade":4,"formula_largura":"FLOOR((LF - 222.8) / 4)","formula_altura":"HF - 163"}'::jsonb,
  acessorios = '[{"codigo":"NYL335","formula_quantidade":"3","descricao":"Vedação superior","status":"validada"},{"codigo":"NYL332","formula_quantidade":"16","descricao":"Guia deslizante com placa","status":"validada"},{"codigo":"NYL414","formula_quantidade":"12","descricao":"Batedeira BAT-FLEX","status":"validada"},{"codigo":"FRA820","formula_quantidade":"2","descricao":"Fechadura bico de papagaio","status":"validada"},{"codigo":"CON409","formula_quantidade":"2","descricao":"Contrafecho lateral","status":"validada"},{"codigo":"RPCS100","formula_quantidade":"8","descricao":"Roldana 100 kg","status":"validada"},{"codigo":"FIT206","formula_quantidade":"(HF - 30) * 3 / 1000","descricao":"Fita 5 x 6 mm","status":"validada"},{"codigo":"FIT246","formula_quantidade":"(HF - 30) * 4 / 1000","descricao":"Fita 7,6 x 6 mm","status":"validada"},{"codigo":"FIT212","formula_quantidade":"Largura * 4 / 1000","descricao":"Fita 5 x 8 mm","status":"validada"},{"codigo":"GUA171","formula_quantidade":"SU053 * 8 / 1000","descricao":"Guarnição espuma 11 x 3,2 mm","status":"validada"},{"codigo":"GUA258","formula_quantidade":"SU280 * 8 / 1000","descricao":"Guarnição espuma 11 x 4,8 mm","status":"validada"},{"codigo":"GUA259","formula_quantidade":"GUA258 + GUA171","descricao":"Guarnição cunha do vidro","status":"validada"},{"codigo":"PAR435","formula_quantidade":"32","descricao":"Parafuso de marco/montagem das folhas","status":"validada"},{"codigo":"NYL042","formula_quantidade":"16","descricao":"Botão tampa-furo","status":"validada"},{"codigo":"PAR1023","formula_quantidade":"12","descricao":"Parafuso mata-junta","status":"validada"},{"codigo":"NYL190","formula_quantidade":"CEIL(Largura / 500) + 2 * CEIL(Altura / 500)","descricao":"Botão de fixação do arremate","status":"validada"},{"codigo":"PAR1025","formula_quantidade":"CEIL(Largura / 500) + 2 * CEIL(Altura / 500)","descricao":"Parafuso do arremate","status":"validada"},{"codigo":"PAR1037","formula_quantidade":"CEIL(Largura / 500) + 2 * CEIL(Altura / 500)","descricao":"Parafuso de fixação","status":"validada"},{"codigo":"BUC755","formula_quantidade":"CEIL(Largura / 500) + 2 * CEIL(Altura / 500)","descricao":"Bucha S-8","status":"validada"},{"codigo":"SIL-PU","formula_quantidade":"(Largura * 2 + Altura * 2) / 6000","descricao":"Silicone PU","status":"validada"}]'::jsonb,
  status = 'validada',
  ativo = false,
  observacoes = concat_ws(E'\n',
    nullif(observacoes,''),
    'Validada pelo comparador técnico W.Vetro em 2026-10-01: 3 amostras históricas dominantes, zero divergências duras, zero regras pendentes e comparação aprovada.'
  ),
  metadados_editor = coalesce(metadados_editor,'{}'::jsonb) || jsonb_build_object(
    'origem_validacao','wvetro_comparador',
    'validacao_data','2026-10-01',
    'amostras_historicas',3,
    'comparacao_aprovada',true,
    'regra_pendente_atlas',0,
    'liberacao_operacional',false
  ),
  updated_at = now()
where tipologia_id = 'ee553629-edd9-46bb-a68f-35eb0b9f3ef4'::uuid
  and configuracao_chave = 'mao_amiga_comum_sem_reforco';

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
  '4aeb8629-221b-42cd-9379-c0ae1bcaf045'::uuid,
  'max1_suprema_bra702_sem_contramarco',
  'MAX1-SUPREMA · 01 módulo · BRA702 · sem contramarco · referência histórica dominante',
  '[]'::jsonb,
  '[{"eixo":"L","codigo":"MP347","formula":"Largura+44","descricao":"Arremate interno horizontal","quantidade":2},{"eixo":"H","codigo":"MP347","formula":"Altura+44","descricao":"Arremate interno vertical","quantidade":2},{"eixo":"L","codigo":"SU079","formula":"Largura-4","descricao":"Marco horizontal","quantidade":2},{"eixo":"H","codigo":"SU079","formula":"Altura-4","descricao":"Marco vertical","quantidade":2},{"eixo":"L","codigo":"SU276","formula":"Largura-4","descricao":"Pingadeira do marco","quantidade":1},{"eixo":"L","codigo":"SU082","formula":"Largura-96","descricao":"Travessa da folha","quantidade":2},{"eixo":"L","codigo":"SU084","formula":"Largura-34","descricao":"Pingadeira da folha","quantidade":1},{"eixo":"H","codigo":"SU081","formula":"Altura-60","descricao":"Montante da folha","quantidade":2},{"eixo":"L","codigo":"SU102","formula":"Largura-96","descricao":"Baguete horizontal","quantidade":2},{"eixo":"H","codigo":"SU102","formula":"Altura-120","descricao":"Baguete vertical","quantidade":2}]'::jsonb,
  '{"quantidade":1,"formula_largura":"Largura-102","formula_altura":"Altura-102"}'::jsonb,
  '[{"codigo":"REBACA4X10","formula_quantidade":"3","status":"em_validacao"},{"codigo":"GUA239","formula_quantidade":"2*(Largura+Altura)/1000","status":"em_validacao"},{"codigo":"GUA007","formula_quantidade":"Largura/1000","status":"em_validacao"},{"codigo":"PAR435","formula_quantidade":"4","status":"em_validacao"},{"codigo":"NYL355","formula_quantidade":"2","status":"em_validacao"},{"codigo":"FEC009D","formula_quantidade":"1","status":"em_validacao"},{"codigo":"BRA702","formula_quantidade":"1","status":"em_validacao"},{"codigo":"GUA256","formula_quantidade":"2*(Largura+Altura)/1000","status":"em_validacao"},{"codigo":"GUA157","formula_quantidade":"(Largura+4*Altura)/1000","status":"em_validacao"},{"codigo":"GUA258","formula_quantidade":"3*Largura/1000","status":"em_validacao"},{"codigo":"NYL190","formula_quantidade":"8","status":"em_validacao"},{"codigo":"PAR1025","formula_quantidade":"8","status":"em_validacao"},{"codigo":"PAR1037","formula_quantidade":"8","status":"em_validacao"},{"codigo":"BUC755","formula_quantidade":"8","status":"em_validacao"},{"codigo":"SIL-PU","formula_quantidade":"2*(Largura+Altura)/12000","status":"em_validacao"},{"codigo":"ALMC25","formula_quantidade":"4","status":"em_validacao"}]'::jsonb,
  'em_validacao',
  false,
  'Materializada a partir do comparador técnico W.Vetro em 2026-10-01. 5 amostras históricas sem divergências duras e sem regras pendentes; acessórios permanecem em validação antes de liberação operacional.',
  jsonb_build_object(
    'origem_validacao','wvetro_comparador',
    'validacao_data','2026-10-01',
    'amostras_historicas',5,
    'comparacao_sem_divergencia_dura',true,
    'regra_pendente_atlas',0,
    'liberacao_operacional',false
  )
where not exists (
  select 1
  from public.engenharia_tipologia_formulas_corte
  where tipologia_id = '4aeb8629-221b-42cd-9379-c0ae1bcaf045'::uuid
    and configuracao_chave = 'max1_suprema_bra702_sem_contramarco'
);
