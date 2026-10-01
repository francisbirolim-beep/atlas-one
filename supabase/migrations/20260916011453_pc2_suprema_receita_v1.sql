-- Receita V1 do único modelo PC2 Suprema. O cadastro permanece inativo para produção.
update public.engenharia_tipologia_formulas_corte f set
  configuracao_label = 'PC2-SUPREMA · Porta de Correr 02 Folhas · Suprema',
  variaveis = '[
    {"chave":"contramarco","label":"Contramarco","opcoes":["sem","cm200"]},
    {"chave":"arremate","label":"Arremate","opcoes":["sem","interno"]},
    {"chave":"trilho","label":"Trilho","opcoes":["macarrao","convencional"]},
    {"chave":"fechamento","label":"Fechamento","opcoes":["fechadura","concha"]},
    {"chave":"mao_amigo_largura","label":"Mão-de-amigo","opcoes":["comum","largo"]},
    {"chave":"reforco_mao_amigo","label":"Reforço","opcoes":["sem_reforco","interno","externo","interno_externo"]},
    {"chave":"roldana","label":"Roldana","opcoes":["100","200"]}
  ]'::jsonb,
  pecas = '[
    {"codigo":"CM200","descricao":"Contramarco horizontal","formula":"Largura-48","quantidade":1,"eixo":"L","condicao_ativa":{"contramarco":["cm200"]}},
    {"codigo":"CM200","descricao":"Contramarco vertical","formula":"Altura-24","quantidade":2,"eixo":"H","condicao_ativa":{"contramarco":["cm200"]}},
    {"codigo":"MP347","descricao":"Arremate interno horizontal","formula":"Largura+20","quantidade":1,"eixo":"L","condicao_ativa":{"arremate":["interno"]}},
    {"codigo":"MP347","descricao":"Arremate interno vertical","formula":"Altura+10","quantidade":2,"eixo":"H","condicao_ativa":{"arremate":["interno"]}},
    {"codigo":"SU001","descricao":"Marco superior","formula":"Largura-30","condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Largura-54"}],"quantidade":1,"eixo":"L"},
    {"codigo":"TMC","descricao":"Trilho macarrão","formula":"Largura-30","condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Largura-54"}],"quantidade":2,"eixo":"L","condicao_ativa":{"trilho":["macarrao"]}},
    {"codigo":"SU007","descricao":"Marco lateral","formula":"Altura-4","condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Altura-16"}],"quantidade":2,"eixo":"H"},
    {"codigo":"SU008","descricao":"Mata junta","formula":"Altura-17","condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Altura-29"}],"quantidade":2,"eixo":"H"},
    {"codigo":"SU053","descricao":"Travessa da folha","formula":"FLOOR((Largura-166)/2)","condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"FLOOR((Largura-190)/2)"},{"quando":{"contramarco":["cm200"],"mao_amigo_largura":["largo"]},"formula":"FLOOR((Largura-212)/2)"}],"quantidade":2,"eixo":"L"},
    {"codigo":"SU225","descricao":"Travessa inferior","formula":"FLOOR((Largura-166)/2)","condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"FLOOR((Largura-190)/2)"},{"quando":{"contramarco":["cm200"],"mao_amigo_largura":["largo"]},"formula":"FLOOR((Largura-212)/2)"}],"quantidade":2,"eixo":"L"},
    {"codigo":"SU280","descricao":"Montante lateral móvel","formula":"Altura-34","condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Altura-46"}],"quantidade":2,"eixo":"H","condicao_ativa":{"fechamento":["fechadura"]}},
    {"grupo":"mao_amigo_interno","descricao":"Mão-de-amigo interno","formula":"Altura-34","condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Altura-46"}],"quantidade":1,"eixo":"H","variaveis_chave":["mao_amigo_largura","reforco_mao_amigo"],"mapa_codigo":{"comum|sem_reforco":"SU040","comum|interno":"SU047","comum|externo":"SU040","comum|interno_externo":"SU047","largo|sem_reforco":"SU243","largo|interno":"SU289","largo|externo":"SU243","largo|interno_externo":"SU289"}},
    {"grupo":"mao_amigo_externo","descricao":"Mão-de-amigo externo","formula":"Altura-34","condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Altura-46"}],"quantidade":1,"eixo":"H","variaveis_chave":["mao_amigo_largura","reforco_mao_amigo"],"mapa_codigo":{"comum|sem_reforco":"SU041","comum|interno":"SU041","comum|externo":"SU049","comum|interno_externo":"SU049","largo|sem_reforco":"SU242","largo|interno":"SU242","largo|externo":"SU290","largo|interno_externo":"SU290"}},
    {"codigo":"SU102","descricao":"Baguete horizontal","formula":"FLOOR((Largura-166)/2)","condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"FLOOR((Largura-190)/2)"},{"quando":{"contramarco":["cm200"],"mao_amigo_largura":["largo"]},"formula":"FLOOR((Largura-212)/2)"}],"quantidade":4,"eixo":"L"},
    {"codigo":"SU102","descricao":"Baguete vertical","formula":"Altura-185","condicoes":[{"quando":{"contramarco":["cm200"]},"formula":"Altura-197"}],"quantidade":4,"eixo":"H"}
  ]'::jsonb,
  vidro = '{"quantidade":2,"formula_largura":"FLOOR((Largura-178)/2)","formula_altura":"Altura-167","condicoes_largura":[{"quando":{"contramarco":["cm200"]},"formula":"FLOOR((Largura-202)/2)"},{"quando":{"contramarco":["cm200"],"mao_amigo_largura":["largo"]},"formula":"FLOOR((Largura-224)/2)"}],"condicoes_altura":[{"quando":{"contramarco":["cm200"]},"formula":"Altura-179"}],"status_larga_cm200":"em_validacao"}'::jsonb,
  acessorios = '[
    {"codigo":"RPCS100","quantidade_referencia":4,"status":"referencia","condicao_ativa":{"roldana":["100"]}},
    {"codigo":"NYL332","quantidade_referencia":8,"status":"referencia"},
    {"codigo":"PAR435","quantidade_referencia":16,"status":"referencia"},
    {"codigo":"CON409","quantidade_referencia":2,"status":"referencia","condicao_ativa":{"fechamento":["fechadura"]}},
    {"codigo":"FRA820","quantidade_referencia":2,"status":"referencia","condicao_ativa":{"fechamento":["fechadura"]}},
    {"codigo":"NYL042","quantidade_referencia":8,"status":"referencia"},
    {"codigo":"NYL335","quantidade_referencia":1,"status":"referencia"},
    {"codigo":"PAR1023","quantidade_referencia":12,"status":"referencia"},
    {"codigo":"PAR1025","quantidade_referencia":15,"status":"referencia"},
    {"codigo":"CHU838","quantidade_referencia":15,"status":"referencia"},
    {"codigo":"NYL190","quantidade_referencia":15,"status":"referencia"},
    {"codigo":"NYL-10002","quantidade_referencia":2,"status":"referencia","condicao_ativa":{"contramarco":["cm200"]}},
    {"codigo":"NYL357","status":"em_validacao","condicao_ativa":{"reforco_mao_amigo":["interno","externo","interno_externo"]}},
    {"codigo":"FIT206","status":"referencia"},{"codigo":"FIT212","status":"referencia"},{"codigo":"FIT246","status":"referencia"},
    {"codigo":"GUA171","status":"referencia"},{"codigo":"GUA258","status":"referencia"},{"codigo":"GUA259","status":"referencia"},{"codigo":"SIL-PU","status":"referencia"}
  ]'::jsonb,
  metadados_editor = f.metadados_editor || '{"folga_largura":4,"folga_altura":4}'::jsonb || '{"codigo":"PC2-SUPREMA","linha":"Suprema","folhas":2,"status":"EM VALIDAÇÃO","versao":1}'::jsonb,
  ativo = false, status = 'em_validacao', versao = 1, updated_at = now()
where f.configuracao_chave = 'pc2_suprema_editor_v1';
