-- Porta de Correr 02 Folhas | Suprema
-- Primeira família de tipologias pesquisáveis no orçamento sob medida.
-- Baseada no caso real W.Vetro orçamento 977 (2000 x 2200), enviado em 10/09/2026.
-- IMPORTANTE: somente a configuração "perfil comum sem reforço" recebe uma receita de REFERÊNCIA.
-- Ela NÃO é promovida a validada automaticamente: as fórmulas dimensionais ainda precisam de
-- pelo menos mais um caso de medida para confirmação antes de entrar em cálculo/compra automáticos.

with novas(chave,label,ordem) as (
  values
    ('l_suprema_pc2_perfil_comum_sem_reforco', 'Porta de Correr 02 Folhas - Perfil Comum - Sem Reforço (L. Suprema)', 210),
    ('l_suprema_pc2_perfil_comum_reforco_aba', 'Porta de Correr 02 Folhas - Perfil Comum - Reforço de Aba (L. Suprema)', 211),
    ('l_suprema_pc2_perfil_comum_reforco_aba_interno', 'Porta de Correr 02 Folhas - Perfil Comum - Reforço de Aba + Interno (L. Suprema)', 212),
    ('l_suprema_pc2_perfil_comum_reforco_aba_externo', 'Porta de Correr 02 Folhas - Perfil Comum - Reforço de Aba + Externo (L. Suprema)', 213),
    ('l_suprema_pc2_perfil_comum_reforco_aba_interno_externo', 'Porta de Correr 02 Folhas - Perfil Comum - Reforço de Aba + Interno + Externo (L. Suprema)', 214)
)
insert into public.tipologias (
  chave,label,categoria,ordem,ativo,origem_referencia,
  linha_origem_wvetro,modelo_origem_wvetro,versao_tecnica,usa_vidro
)
select
  n.chave,n.label,'porta',n.ordem,true,'atlas',
  'L. Suprema','Porta De Correr 02 Folhas',1,true
from novas n
where not exists (select 1 from public.tipologias t where t.chave=n.chave);

insert into public.linha_tipologias(linha_id,tipologia_id)
select l.id,t.id
from public.linhas_tecnicas l
join public.tipologias t on t.chave in (
  'l_suprema_pc2_perfil_comum_sem_reforco',
  'l_suprema_pc2_perfil_comum_reforco_aba',
  'l_suprema_pc2_perfil_comum_reforco_aba_interno',
  'l_suprema_pc2_perfil_comum_reforco_aba_externo',
  'l_suprema_pc2_perfil_comum_reforco_aba_interno_externo'
)
where lower(trim(l.nome)) in ('l. suprema','suprema')
  and not exists (
    select 1 from public.linha_tipologias lt
    where lt.linha_id=l.id and lt.tipologia_id=t.id
  );

-- Caso técnico de referência: orçamento W.Vetro 977, 2000 x 2200 mm.
-- LF=1996 e HF=2196 considerando a folga total de 4 mm já aplicada pelo motor Atlas.
-- Os descontos abaixo reproduzem ESTE caso, mas permanecem status "referencia".
insert into public.engenharia_tipologia_formulas_corte (
  tipologia_id,variaveis,pecas,ativo,configuracao_chave,configuracao_label,
  status,versao,observacoes,vidro,acessorios
)
select
  t.id,
  '[]'::jsonb,
  '[
    {"eixo":"L","codigo":"SU001","formula":"LF - 26","descricao":"Marco superior / correr 2","quantidade":1,"composicao_desconto":"Referência W.Vetro 977: 1970 mm"},
    {"eixo":"L","codigo":"TMC","formula":"LF - 26","descricao":"Trilho macarrão de embutir meia-cana","quantidade":2,"composicao_desconto":"Referência W.Vetro 977: 1970 mm"},
    {"eixo":"H","codigo":"SU007","formula":"HF","descricao":"Marco lateral / correr 2","quantidade":2,"composicao_desconto":"Referência W.Vetro 977: 2196 mm"},
    {"eixo":"H","codigo":"SU008","formula":"HF - 13","descricao":"Mata junta / complemento do marco","quantidade":2,"composicao_desconto":"Referência W.Vetro 977: 2183 mm"},
    {"eixo":"L","codigo":"SU053","formula":"CEIL((LF - 138) / 2)","descricao":"Travessa da folha","quantidade":2,"composicao_desconto":"Hipótese provisória que reproduz 929 mm no caso 2000 x 2200"},
    {"eixo":"L","codigo":"SU225","formula":"CEIL((LF - 138) / 2)","descricao":"Travessa inferior da folha","quantidade":2,"composicao_desconto":"Hipótese provisória que reproduz 929 mm no caso 2000 x 2200"},
    {"eixo":"H","codigo":"SU039","formula":"HF - 30","descricao":"Montante de folha - perfil comum sem reforço","quantidade":2,"composicao_desconto":"Referência W.Vetro 977: 2166 mm"},
    {"eixo":"H","codigo":"SU040","formula":"HF - 30","descricao":"Montante mão-de-amigo interno - perfil comum sem reforço","quantidade":1,"composicao_desconto":"Referência W.Vetro 977: 2166 mm"},
    {"eixo":"H","codigo":"SU041","formula":"HF - 30","descricao":"Montante mão-de-amigo - perfil comum sem reforço","quantidade":1,"composicao_desconto":"Referência W.Vetro 977: 2166 mm"},
    {"eixo":"L","codigo":"SU102","formula":"CEIL((LF - 138) / 2)","descricao":"Baguete horizontal","quantidade":4,"composicao_desconto":"Hipótese provisória que reproduz 929 mm no caso 2000 x 2200"},
    {"eixo":"H","codigo":"SU102","formula":"HF - 181","descricao":"Baguete vertical","quantidade":4,"composicao_desconto":"Referência W.Vetro 977: 2015 mm"}
  ]'::jsonb,
  true,
  'pc2_perfil_comum_sem_reforco',
  'Perfil comum sem reforço - referência W.Vetro 977',
  'referencia',
  1,
  'Caso real W.Vetro orçamento 977: 2000x2200, todas móveis, sem contramarco, sem arremate, trilho de embutir, perfil comum sem reforço, fechadura, sem puxador e roldana 100 kg. Não promover para validada sem segundo caso dimensional.',
  '{"quantidade":2,"formula_largura":"CEIL((LF - 150) / 2)","formula_altura":"HF - 163","arredondamento":"referencia_wvetro","observacao":"Reproduz 923 x 2033 mm no orçamento 977; confirmar em outra medida."}'::jsonb,
  '[
    {"codigo":"BUC755","descricao":"Bucha de nylon p/ fixação S-8","quantidade_referencia":14,"status":"referencia"},
    {"codigo":"CON409","descricao":"Contrafecho lateral da fechadura","quantidade_referencia":2,"status":"referencia"},
    {"codigo":"FIT206","descricao":"Fita de vedação 5 x 6 mm","quantidade_referencia":2.166,"status":"referencia"},
    {"codigo":"FIT212","descricao":"Fita de vedação 5 x 8 mm","quantidade_referencia":8,"status":"referencia"},
    {"codigo":"FIT246","descricao":"Fita vedadora 7,6 x 6 mm","quantidade_referencia":8.664,"status":"referencia"},
    {"codigo":"FRA820","descricao":"Fechadura bico de papagaio","quantidade_referencia":2,"status":"referencia"},
    {"codigo":"GUA171","descricao":"Guarnição espuma adesiva 11 x 3,2 mm","quantidade_referencia":3.7168,"status":"referencia"},
    {"codigo":"GUA258","descricao":"Guarnição espuma adesiva 11 x 4,8 mm","quantidade_referencia":8.664,"status":"referencia"},
    {"codigo":"GUA259","descricao":"Guarnição cunha do vidro 12 x 4,2","quantidade_referencia":12.3808,"status":"referencia"},
    {"codigo":"NYL042","descricao":"Botão tampa furo 3/8 nylon","quantidade_referencia":8,"status":"referencia"},
    {"codigo":"NYL332","descricao":"Guia deslizante com placa","quantidade_referencia":8,"status":"referencia"},
    {"codigo":"NYL335","descricao":"Vedação superior","quantidade_referencia":1,"status":"referencia"},
    {"codigo":"PAR1023","descricao":"Parafuso AA CP 3,9 x 9,5 mm inox","quantidade_referencia":12,"status":"referencia"},
    {"codigo":"PAR1037","descricao":"Parafuso AA CP 4,8 x 50 mm inox","quantidade_referencia":14,"status":"referencia"},
    {"codigo":"PAR435","descricao":"Parafuso AA CP PP 4,8 x 32 mm inox","quantidade_referencia":16,"status":"referencia"},
    {"codigo":"RPCS100","descricao":"Roldana simples côncava Suprema/Mega 25 - 100 kg","quantidade_referencia":4,"status":"referencia"},
    {"codigo":"SIL-PU","descricao":"Silicone de poliuretano","quantidade_referencia":1.4,"status":"referencia"}
  ]'::jsonb
from public.tipologias t
where t.chave='l_suprema_pc2_perfil_comum_sem_reforco'
  and not exists (
    select 1 from public.engenharia_tipologia_formulas_corte f
    where f.tipologia_id=t.id and f.configuracao_chave='pc2_perfil_comum_sem_reforco'
  );
