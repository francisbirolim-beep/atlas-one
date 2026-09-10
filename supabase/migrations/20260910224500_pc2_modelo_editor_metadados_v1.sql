alter table public.engenharia_tipologia_formulas_corte
  add column if not exists metadados_editor jsonb not null default '{}'::jsonb;

insert into public.engenharia_tipologia_formulas_corte (
  tipologia_id, variaveis, pecas, ativo, configuracao_chave, configuracao_label,
  status, versao, observacoes, vidro, acessorios, metadados_editor
)
select
  t.id,
  '[
    {"chave":"contramarco","label":"Contramarco","opcoes":["sem","cm200"]},
    {"chave":"mao_amigo_largura","label":"Mão-de-amigo","opcoes":["comum","largo"]},
    {"chave":"reforco_mao_amigo","label":"Reforço da mão-de-amigo","opcoes":["sem_reforco","interno","externo","interno_externo"]},
    {"chave":"fechamento","label":"Modo de fechamento","opcoes":["fechadura","concha"]}
  ]'::jsonb,
  '[
    {"codigo":"SU001","descricao":"Marco superior / correr 2","formula":"Largura - 30","quantidade":1,"eixo":"L"},
    {"codigo":"TMC","descricao":"Trilho macarrão de embutir","formula":"Largura - 30","quantidade":2,"eixo":"L"},
    {"codigo":"SU007","descricao":"Marco lateral / correr 2","formula":"Altura - 4","quantidade":2,"eixo":"H"},
    {"codigo":"SU008","descricao":"Mata junta / complemento do marco","formula":"Altura - 17","quantidade":2,"eixo":"H"},
    {"codigo":"SU053","descricao":"Travessa da folha","formula":"FLOOR(Largura / 2 - 83)","quantidade":2,"eixo":"L"},
    {"codigo":"SU225","descricao":"Travessa inferior da folha","formula":"FLOOR(Largura / 2 - 83)","quantidade":2,"eixo":"L"},
    {"grupo":"montante_lateral","descricao":"Montante lateral móvel","formula":"Altura - 34","quantidade":2,"eixo":"H","variaveis_chave":["fechamento"],"mapa_codigo":{"fechadura":"SU280","concha":"SU039"}},
    {"grupo":"mao_amigo_interno","descricao":"Mão-de-amigo interno","formula":"Altura - 34","quantidade":1,"eixo":"H","variaveis_chave":["mao_amigo_largura","reforco_mao_amigo"],"mapa_codigo":{"comum|sem_reforco":"SU040","comum|interno":"SU047","comum|externo":"SU040","comum|interno_externo":"SU047","largo|sem_reforco":"SU243","largo|interno":"SU289","largo|externo":"SU243","largo|interno_externo":"SU289"}},
    {"grupo":"mao_amigo_externo","descricao":"Mão-de-amigo externo","formula":"Altura - 34","quantidade":1,"eixo":"H","variaveis_chave":["mao_amigo_largura","reforco_mao_amigo"],"mapa_codigo":{"comum|sem_reforco":"SU041","comum|interno":"SU041","comum|externo":"SU049","comum|interno_externo":"SU049","largo|sem_reforco":"SU242","largo|interno":"SU242","largo|externo":"SU290","largo|interno_externo":"SU290"}},
    {"codigo":"SU102","descricao":"Baguete horizontal","formula":"FLOOR(Largura / 2 - 83)","quantidade":4,"eixo":"L"},
    {"codigo":"SU102","descricao":"Baguete vertical","formula":"Altura - 185","quantidade":4,"eixo":"H"}
  ]'::jsonb,
  false,
  'pc2_suprema_editor_v1',
  'Porta 2F Suprema — editor paramétrico',
  'em_validacao',
  1,
  'Editor de desenvolvimento da Porta de Correr 02 Folhas Suprema. Usa somente regras observadas/validadas nos relatórios W.Vetro enviados em 10/09/2026. Combinações ainda não comprovadas devem permanecer em validação.',
  '{"quantidade":2,"formula_largura":"FLOOR(Largura / 2 - 89)","formula_altura":"Altura - 167","arredondamento":"para_baixo"}'::jsonb,
  '[
    {"codigo":"CON409","descricao":"Contrafecho lateral da fechadura","quantidade_referencia":2,"status":"validada"},
    {"codigo":"FRA820","descricao":"Fechadura bico de papagaio","quantidade_referencia":2,"status":"validada"},
    {"codigo":"NYL332","descricao":"Guia deslizante com placa","quantidade_referencia":8,"status":"validada"},
    {"codigo":"NYL335","descricao":"Vedação superior","quantidade_referencia":1,"status":"validada"},
    {"codigo":"RPCS100","descricao":"Roldana simples côncava 100 kg","quantidade_referencia":4,"status":"validada"},
    {"codigo":"PAR435","descricao":"Parafuso AA CP PP 4,8 x 32 inox","quantidade_referencia":16,"status":"referencia"}
  ]'::jsonb,
  '{"descricao_orcamento":"Porta de Correr 02 Folhas Móveis | Suprema","descricao_pesquisa":"Porta 2 Folhas | Suprema | Perfil comum/largo | Reforço interno/externo","folga_largura":4,"folga_altura":4,"origem":"W.Vetro orçamento 977"}'::jsonb
from public.tipologias t
where t.id='58c23780-b110-48ca-b478-0942573d3dd4'
  and not exists (
    select 1 from public.engenharia_tipologia_formulas_corte f
    where f.tipologia_id=t.id and f.configuracao_chave='pc2_suprema_editor_v1'
  );