alter table public.engenharia_tipologia_formulas_corte
  add column if not exists acessorios jsonb not null default '[]'::jsonb;

-- Base em validação a partir dos orientativos W.Vetro 2000x2100 comparados em 22/08/2026.
-- Regras confirmadas por progressão PC2/PC3/PC4 ficam em fórmula; consumos ainda não
-- decompostos por dimensão permanecem como quantidade-base + observação explícita.

with alvo as (
  select f.id, t.label
  from public.engenharia_tipologia_formulas_corte f
  join public.tipologias t on t.id = f.tipologia_id
  where f.configuracao_chave = 'mao_amiga_larga_sem_reforco'
    and t.label in (
      'Porta De Correr 02 Folhas (L. Suprema)',
      'Porta De Correr 03 Folhas (L. Suprema)',
      'Porta De Correr 04 Folhas (L. Suprema)'
    )
)
update public.engenharia_tipologia_formulas_corte f
set acessorios = case a.label
  when 'Porta De Correr 02 Folhas (L. Suprema)' then jsonb_build_array(
    jsonb_build_object('codigo','NYL335','descricao','VEDAÇÃO SUPERIOR','unidade','UN','formula','Folhas - 1','cor','PRETO','origem_calculo','1 por encontro: Folhas - 1','ativo',true),
    jsonb_build_object('codigo','NYL332','descricao','GUIA DESLIZANTE COM PLACA','unidade','UN','formula','Folhas * 4','cor','PRETO','origem_calculo','4 guias por folha móvel','ativo',true),
    jsonb_build_object('codigo','FRA820','descricao','FECHADURA BICO DE PAPAGAIO PARA PORTA','unidade','UN','quantidade_base',2,'cor','PRETO','origem_calculo','Quantidade fixa nesta montagem com fechadura','ativo',true),
    jsonb_build_object('codigo','CON409','descricao','CONTRAFECHO LATERAL DA FECHADURA','unidade','UN','quantidade_base',2,'cor','PRETO','origem_calculo','Quantidade fixa nesta montagem com fechadura','ativo',true),
    jsonb_build_object('codigo','RPCS100','descricao','ROLDANA SIMPLES CÔNCAVA SUPREMA/MEGA','unidade','UN','formula','Folhas * 2','cor','NATURAL','origem_calculo','2 roldanas por folha móvel','ativo',true),
    jsonb_build_object('codigo','FIT206','descricao','FITA DE VEDAÇÃO SEM BARREIRA PLÁSTICA 5','unidade','MT','formula','SU243 * Encontros / 1000','cor','PRETO','origem_calculo','Comprimento da mão-amiga × encontros','ativo',true),
    jsonb_build_object('codigo','FIT246','descricao','FITA VEDADORA SEM BARREIRA PLÁSTICA 7,6','unidade','MT','formula','SU280 * 4 / 1000','cor','PRETO','origem_calculo','4 linhas verticais nos montantes laterais','ativo',true),
    jsonb_build_object('codigo','FIT212','descricao','FITA DE VEDAÇÃO SEM BARREIRA PLÁSTICA 5','unidade','MT','formula','Largura * 4 / 1000','cor','PRETO','origem_calculo','4 vezes a largura nominal da esquadria','ativo',true),
    jsonb_build_object('codigo','GUA258','descricao','GUARNIÇÃO ESPUMA ADESIVA 11 X 4,8 MM','unidade','MT','formula','SU280 * Folhas * 2 / 1000','cor','PRETO','origem_calculo','Duas laterais verticais por folha','ativo',true),
    jsonb_build_object('codigo','GUA171','descricao','GUARNIÇÃO ESPUMA ADESIVA 11 X 3,2 MM','unidade','MT','quantidade_base',3.623,'cor','PRETO','origem_calculo','W.Vetro 2000x2100; fórmula horizontal geométrica ainda em validação','observacao','Não generalizar para outra largura até validar a fórmula bruta da folha.','ativo',true),
    jsonb_build_object('codigo','GUA259','descricao','GUARNIÇÃO CUNHA DO VIDRO 12 X 4,2 - EPDM','unidade','MT','formula','GUA258 + GUA171','cor','PRETO','origem_calculo','Soma da vedação vertical com a horizontal do vidro','ativo',true),
    jsonb_build_object('codigo','PAR435','descricao','PARAFUSO AA CP PP 4,8 X 32 MM INOX - PAR MARCO','unidade','UN','formula','Folhas * 2','cor','NATURAL','origem_calculo','2 parafusos de marco por folha','ativo',true),
    jsonb_build_object('codigo','PAR435','descricao','PARAFUSO AA CP PP 4,8 X 32 MM INOX - MONTAR FOLHAS','unidade','UN','formula','Folhas * 6','cor','NATURAL','origem_calculo','6 parafusos para montagem por folha','ativo',true),
    jsonb_build_object('codigo','NYL042','descricao','BOTÃO TAMPA FURO 3/8 NYLON','unidade','UN','formula','Folhas * 4','cor','PRETO','origem_calculo','4 tapa-furos por folha','ativo',true),
    jsonb_build_object('codigo','PAR1023','descricao','PARAFUSO AA CP 3,9 X 9,5 MM INOX - FIXAR MATA-JUNTA','unidade','UN','quantidade_base',12,'cor','NATURAL','origem_calculo','PC2-PC4 mantiveram 12 em 2000x2100','observacao','Fórmula por marco/mata-junta ainda a validar.','ativo',true),
    jsonb_build_object('codigo','NYL-10005','descricao','CONEXÃO DE NYLON PARA CONTRAMARCO','unidade','UN','quantidade_base',2,'cor','PRETO','origem_calculo','2 conectores nesta montagem de contramarco','ativo',true),
    jsonb_build_object('codigo','CHU838','descricao','CHUMBADOR DE ALUMÍNIO MULTIUSO','unidade','UN','quantidade_base',14,'cor','FOSCO','origem_calculo','PC2-PC4 mantiveram 14 em 2000x2100','observacao','Fórmula por dimensão/espaçamento ainda a validar.','ativo',true),
    jsonb_build_object('codigo','NYL190','descricao','BOTÃO DE NYL FIXAÇÃO DO ARREMATE','unidade','UN','quantidade_base',14,'cor','PRETO','origem_calculo','Acompanha os pontos do arremate; fórmula por dimensão ainda a validar','ativo',true),
    jsonb_build_object('codigo','PAR1025','descricao','PARAFUSO AA CP 4,2 X 16 MM INOX - ARREMATE','unidade','UN','quantidade_base',14,'cor','NATURAL','origem_calculo','Acompanha NYL190; fórmula por dimensão ainda a validar','ativo',true),
    jsonb_build_object('codigo','SIL-PU','descricao','SILICONE DE POLIURETANO','unidade','TB','quantidade_base',1.367,'cor','PRETO','origem_calculo','Consumo W.Vetro em 2000x2100; fórmula de vedação externa ainda a validar','ativo',true)
  )
  when 'Porta De Correr 03 Folhas (L. Suprema)' then jsonb_build_array(
    jsonb_build_object('codigo','NYL335','descricao','VEDAÇÃO SUPERIOR','unidade','UN','formula','Folhas - 1','cor','PRETO','origem_calculo','1 por encontro: Folhas - 1','ativo',true),
    jsonb_build_object('codigo','NYL332','descricao','GUIA DESLIZANTE COM PLACA','unidade','UN','formula','Folhas * 4','cor','PRETO','origem_calculo','4 guias por folha móvel','ativo',true),
    jsonb_build_object('codigo','NYL414','descricao','BATEDEIRA BAT-FLEX','unidade','UN','formula','Encontros * 4','cor','PRETO','origem_calculo','PC3 e PC4: 4 batedeiras por encontro','observacao','PC2 não trouxe NYL414; manter regra em validação.','ativo',true),
    jsonb_build_object('codigo','FRA820','descricao','FECHADURA BICO DE PAPAGAIO PARA PORTA','unidade','UN','quantidade_base',2,'cor','PRETO','origem_calculo','Quantidade fixa nesta montagem com fechadura','ativo',true),
    jsonb_build_object('codigo','CON409','descricao','CONTRAFECHO LATERAL DA FECHADURA','unidade','UN','quantidade_base',2,'cor','PRETO','origem_calculo','Quantidade fixa nesta montagem com fechadura','ativo',true),
    jsonb_build_object('codigo','RPCS100','descricao','ROLDANA SIMPLES CÔNCAVA SUPREMA/MEGA','unidade','UN','formula','Folhas * 2','cor','NATURAL','origem_calculo','2 roldanas por folha móvel','ativo',true),
    jsonb_build_object('codigo','FIT206','descricao','FITA DE VEDAÇÃO SEM BARREIRA PLÁSTICA 5','unidade','MT','formula','SU243 * Encontros / 1000','cor','PRETO','origem_calculo','Comprimento da mão-amiga × encontros','ativo',true),
    jsonb_build_object('codigo','FIT246','descricao','FITA VEDADORA SEM BARREIRA PLÁSTICA 7,6','unidade','MT','formula','SU280 * 4 / 1000','cor','PRETO','origem_calculo','4 linhas verticais nos montantes laterais','ativo',true),
    jsonb_build_object('codigo','FIT212','descricao','FITA DE VEDAÇÃO SEM BARREIRA PLÁSTICA 5','unidade','MT','formula','Largura * 4 / 1000','cor','PRETO','origem_calculo','4 vezes a largura nominal da esquadria','ativo',true),
    jsonb_build_object('codigo','GUA258','descricao','GUARNIÇÃO ESPUMA ADESIVA 11 X 4,8 MM','unidade','MT','formula','SU280 * Folhas * 2 / 1000','cor','PRETO','origem_calculo','Duas laterais verticais por folha','ativo',true),
    jsonb_build_object('codigo','GUA171','descricao','GUARNIÇÃO ESPUMA ADESIVA 11 X 3,2 MM','unidade','MT','quantidade_base',3.542,'cor','PRETO','origem_calculo','W.Vetro 2000x2100; fórmula horizontal geométrica ainda em validação','observacao','Não generalizar para outra largura até validar a medida bruta da folha.','ativo',true),
    jsonb_build_object('codigo','GUA259','descricao','GUARNIÇÃO CUNHA DO VIDRO 12 X 4,2 - EPDM','unidade','MT','formula','GUA258 + GUA171','cor','PRETO','origem_calculo','Soma da vedação vertical com a horizontal do vidro','ativo',true),
    jsonb_build_object('codigo','PAR435','descricao','PARAFUSO AA CP PP 4,8 X 32 MM INOX - PAR MARCO','unidade','UN','formula','Folhas * 2','cor','NATURAL','origem_calculo','2 parafusos de marco por folha','ativo',true),
    jsonb_build_object('codigo','PAR435','descricao','PARAFUSO AA CP PP 4,8 X 32 MM INOX - MONTAR FOLHAS','unidade','UN','formula','Folhas * 6','cor','NATURAL','origem_calculo','6 parafusos para montagem por folha','ativo',true),
    jsonb_build_object('codigo','NYL042','descricao','BOTÃO TAMPA FURO 3/8 NYLON','unidade','UN','formula','Folhas * 4','cor','PRETO','origem_calculo','4 tapa-furos por folha','ativo',true),
    jsonb_build_object('codigo','PAR1023','descricao','PARAFUSO AA CP 3,9 X 9,5 MM INOX - FIXAR MATA-JUNTA','unidade','UN','quantidade_base',12,'cor','NATURAL','origem_calculo','PC2-PC4 mantiveram 12 em 2000x2100','observacao','Fórmula por marco/mata-junta ainda a validar.','ativo',true),
    jsonb_build_object('codigo','NYL-10005','descricao','CONEXÃO DE NYLON PARA CONTRAMARCO','unidade','UN','quantidade_base',2,'cor','PRETO','origem_calculo','2 conectores nesta montagem de contramarco','ativo',true),
    jsonb_build_object('codigo','CHU838','descricao','CHUMBADOR DE ALUMÍNIO MULTIUSO','unidade','UN','quantidade_base',14,'cor','FOSCO','origem_calculo','PC2-PC4 mantiveram 14 em 2000x2100','observacao','Fórmula por dimensão/espaçamento ainda a validar.','ativo',true),
    jsonb_build_object('codigo','NYL190','descricao','BOTÃO DE NYL FIXAÇÃO DO ARREMATE','unidade','UN','quantidade_base',14,'cor','PRETO','origem_calculo','Acompanha os pontos do arremate; fórmula por dimensão ainda a validar','ativo',true),
    jsonb_build_object('codigo','PAR1025','descricao','PARAFUSO AA CP 4,2 X 16 MM INOX - ARREMATE','unidade','UN','quantidade_base',14,'cor','NATURAL','origem_calculo','Acompanha NYL190; fórmula por dimensão ainda a validar','ativo',true),
    jsonb_build_object('codigo','SIL-PU','descricao','SILICONE DE POLIURETANO','unidade','TB','quantidade_base',1.367,'cor','PRETO','origem_calculo','Consumo W.Vetro em 2000x2100; fórmula de vedação externa ainda a validar','ativo',true)
  )
  when 'Porta De Correr 04 Folhas (L. Suprema)' then jsonb_build_array(
    jsonb_build_object('codigo','NYL335','descricao','VEDAÇÃO SUPERIOR','unidade','UN','formula','Folhas - 1','cor','PRETO','origem_calculo','1 por encontro: Folhas - 1','ativo',true),
    jsonb_build_object('codigo','NYL332','descricao','GUIA DESLIZANTE COM PLACA','unidade','UN','formula','Folhas * 4','cor','PRETO','origem_calculo','4 guias por folha móvel','ativo',true),
    jsonb_build_object('codigo','NYL414','descricao','BATEDEIRA BAT-FLEX','unidade','UN','formula','Encontros * 4','cor','PRETO','origem_calculo','PC3 e PC4: 4 batedeiras por encontro','observacao','PC2 não trouxe NYL414; manter regra em validação.','ativo',true),
    jsonb_build_object('codigo','FRA820','descricao','FECHADURA BICO DE PAPAGAIO PARA PORTA','unidade','UN','quantidade_base',2,'cor','PRETO','origem_calculo','Quantidade fixa nesta montagem com fechadura','ativo',true),
    jsonb_build_object('codigo','CON409','descricao','CONTRAFECHO LATERAL DA FECHADURA','unidade','UN','quantidade_base',2,'cor','PRETO','origem_calculo','Quantidade fixa nesta montagem com fechadura','ativo',true),
    jsonb_build_object('codigo','RPCS100','descricao','ROLDANA SIMPLES CÔNCAVA SUPREMA/MEGA','unidade','UN','formula','Folhas * 2','cor','NATURAL','origem_calculo','2 roldanas por folha móvel','ativo',true),
    jsonb_build_object('codigo','FIT206','descricao','FITA DE VEDAÇÃO SEM BARREIRA PLÁSTICA 5','unidade','MT','formula','SU243 * Encontros / 1000','cor','PRETO','origem_calculo','Comprimento da mão-amiga × encontros','ativo',true),
    jsonb_build_object('codigo','FIT246','descricao','FITA VEDADORA SEM BARREIRA PLÁSTICA 7,6','unidade','MT','formula','SU280 * 4 / 1000','cor','PRETO','origem_calculo','4 linhas verticais nos montantes laterais','ativo',true),
    jsonb_build_object('codigo','FIT212','descricao','FITA DE VEDAÇÃO SEM BARREIRA PLÁSTICA 5','unidade','MT','formula','Largura * 4 / 1000','cor','PRETO','origem_calculo','4 vezes a largura nominal da esquadria','ativo',true),
    jsonb_build_object('codigo','GUA258','descricao','GUARNIÇÃO ESPUMA ADESIVA 11 X 4,8 MM','unidade','MT','formula','SU280 * Folhas * 2 / 1000','cor','PRETO','origem_calculo','Duas laterais verticais por folha','ativo',true),
    jsonb_build_object('codigo','GUA171','descricao','GUARNIÇÃO ESPUMA ADESIVA 11 X 3,2 MM','unidade','MT','quantidade_base',3.460,'cor','PRETO','origem_calculo','W.Vetro 2000x2100; fórmula horizontal geométrica ainda em validação','observacao','Não generalizar para outra largura até validar a medida bruta da folha.','ativo',true),
    jsonb_build_object('codigo','GUA259','descricao','GUARNIÇÃO CUNHA DO VIDRO 12 X 4,2 - EPDM','unidade','MT','formula','GUA258 + GUA171','cor','PRETO','origem_calculo','Soma da vedação vertical com a horizontal do vidro','ativo',true),
    jsonb_build_object('codigo','PAR435','descricao','PARAFUSO AA CP PP 4,8 X 32 MM INOX - PAR MARCO','unidade','UN','formula','Folhas * 2','cor','NATURAL','origem_calculo','2 parafusos de marco por folha','ativo',true),
    jsonb_build_object('codigo','PAR435','descricao','PARAFUSO AA CP PP 4,8 X 32 MM INOX - MONTAR FOLHAS','unidade','UN','formula','Folhas * 6','cor','NATURAL','origem_calculo','6 parafusos para montagem por folha','ativo',true),
    jsonb_build_object('codigo','NYL042','descricao','BOTÃO TAMPA FURO 3/8 NYLON','unidade','UN','formula','Folhas * 4','cor','PRETO','origem_calculo','4 tapa-furos por folha','ativo',true),
    jsonb_build_object('codigo','PAR1023','descricao','PARAFUSO AA CP 3,9 X 9,5 MM INOX - FIXAR MATA-JUNTA','unidade','UN','quantidade_base',12,'cor','NATURAL','origem_calculo','PC2-PC4 mantiveram 12 em 2000x2100','observacao','Fórmula por marco/mata-junta ainda a validar.','ativo',true),
    jsonb_build_object('codigo','NYL-10005','descricao','CONEXÃO DE NYLON PARA CONTRAMARCO','unidade','UN','quantidade_base',2,'cor','PRETO','origem_calculo','2 conectores nesta montagem de contramarco','ativo',true),
    jsonb_build_object('codigo','CHU838','descricao','CHUMBADOR DE ALUMÍNIO MULTIUSO','unidade','UN','quantidade_base',14,'cor','FOSCO','origem_calculo','PC2-PC4 mantiveram 14 em 2000x2100','observacao','Fórmula por dimensão/espaçamento ainda a validar.','ativo',true),
    jsonb_build_object('codigo','NYL190','descricao','BOTÃO DE NYL FIXAÇÃO DO ARREMATE','unidade','UN','quantidade_base',14,'cor','PRETO','origem_calculo','Acompanha os pontos do arremate; fórmula por dimensão ainda a validar','ativo',true),
    jsonb_build_object('codigo','PAR1025','descricao','PARAFUSO AA CP 4,2 X 16 MM INOX - ARREMATE','unidade','UN','quantidade_base',14,'cor','NATURAL','origem_calculo','Acompanha NYL190; fórmula por dimensão ainda a validar','ativo',true),
    jsonb_build_object('codigo','SIL-PU','descricao','SILICONE DE POLIURETANO','unidade','TB','quantidade_base',1.367,'cor','PRETO','origem_calculo','Consumo W.Vetro em 2000x2100; fórmula de vedação externa ainda a validar','ativo',true)
  )
  else f.acessorios
end,
updated_at = now()
from alvo a
where f.id = a.id;
