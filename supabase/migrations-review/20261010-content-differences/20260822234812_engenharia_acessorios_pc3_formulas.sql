-- Acessórios calculáveis por configuração técnica.
-- Primeira carga: relatório W.Vetro de acessórios do orçamento 835 informado pelo usuário como base da Porta de Correr 03 Folhas Suprema.
-- As quantidades do PDF são referência; fórmulas geométricas inferidas ficam explicitamente EM VALIDAÇÃO.

begin;

alter table public.engenharia_tipologia_formulas_corte
  add column if not exists acessorios jsonb not null default '[]'::jsonb;

create or replace function public.registrar_historico_formula_corte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if row(NEW.variaveis, NEW.pecas, NEW.vidro, NEW.acessorios, NEW.configuracao_label, NEW.status, NEW.ativo, NEW.observacoes)
     is distinct from
     row(OLD.variaveis, OLD.pecas, OLD.vidro, OLD.acessorios, OLD.configuracao_label, OLD.status, OLD.ativo, OLD.observacoes) then
    insert into public.engenharia_tipologia_formulas_corte_historico (formula_id, versao, snapshot)
    values (OLD.id, OLD.versao, to_jsonb(OLD));
    NEW.versao := OLD.versao + 1;
    NEW.updated_at := now();
  end if;
  return NEW;
end;
$$;

-- A carga inicial fica somente na configuração legada PC3, para não assumir que
-- vedações/consumos são idênticos entre mão-amiga comum, larga e seus reforços.
update public.engenharia_tipologia_formulas_corte f
set acessorios = jsonb_build_array(
  jsonb_build_object('codigo','CHU838','descricao','Chumbador de alumínio multiuso','cor','FOSCO','unidade','UN','formula_quantidade','15','quantidade_referencia',15,'status','em_validacao','composicao_calculo','15 un no relatório W.Vetro. Regra de fixação ainda sem decomposição geométrica validada.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','CON409','descricao','Contrafecho lateral da fechadura','cor','PRETO','unidade','UN','formula_quantidade','2','quantidade_referencia',2,'status','em_validacao','composicao_calculo','2 un no relatório W.Vetro para a configuração com fechadura.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','FIT206','descricao','Fita de vedação sem barreira plástica 5 x 6 mm','cor','PRETO','unidade','MT','formula_quantidade','2 * ((HF - 42) / 1000)','quantidade_referencia',4.108,'status','em_validacao','composicao_calculo','Fórmula candidata para reproduzir 4,108 m no teste 2500×2100: HF=2096; 2096−42=2054 mm; 2×2,054=4,108 m. Validar em uma segunda medida antes de liberar.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','FIT212','descricao','Fita de vedação sem barreira plástica 5 x 8 mm','cor','PRETO','unidade','MT','formula_quantidade','4 * ((LF - 20) / 1000)','quantidade_referencia',9.904,'status','em_validacao','composicao_calculo','Fórmula candidata para reproduzir 9,904 m no teste 2500×2100: LF=2496; 2496−20=2476 mm; 4×2,476=9,904 m. Validar em uma segunda medida.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','FIT246','descricao','Fita vedadora sem barreira plástica 7,6 x 6 mm','cor','PRETO','unidade','MT','formula_quantidade','4 * ((HF - 42) / 1000)','quantidade_referencia',8.216,'status','em_validacao','composicao_calculo','Fórmula candidata: 4×(HF−42). Em 2100 mm: 4×2,054=8,216 m. Validar em uma segunda medida.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','FRA820','descricao','Fechadura bico de papagaio para porta de correr','cor','PRETO','unidade','UN','formula_quantidade','2','quantidade_referencia',2,'status','em_validacao','composicao_calculo','2 un no relatório W.Vetro; confirmar se permanece fixo nas demais configurações de fechamento.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','GUA171','descricao','Guarnição espuma adesiva 11 x 3,2 mm','cor','PRETO','unidade','MT','formula_quantidade','','quantidade_referencia',4.5832,'status','referencia','composicao_calculo','O PDF informa 4,58320 m, mas não expõe a decomposição da fórmula. Mantido como referência até comparar outra medida.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','GUA258','descricao','Guarnição espuma adesiva 11 x 4,8 mm','cor','PRETO','unidade','MT','formula_quantidade','6 * ((HF - 42) / 1000)','quantidade_referencia',12.324,'status','em_validacao','composicao_calculo','Fórmula candidata: 6×(HF−42). Em 2100 mm: 6×2,054=12,324 m. Validar em outra medida.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','GUA259','descricao','Guarnição cunha do vidro 12 x 4,2 EPDM','cor','PRETO','unidade','MT','formula_quantidade','','quantidade_referencia',16.9072,'status','referencia','composicao_calculo','No relatório, 16,90720 m = GUA171 4,58320 + GUA258 12,32400. A dependência geométrica ainda precisa ser validada antes de transformar em fórmula automática.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','NYL042','descricao','Botão tampa furo 3/8 nylon','cor','PRETO','unidade','UN','formula_quantidade','4 * 3','quantidade_referencia',12,'status','em_validacao','composicao_calculo','4 un por folha × 3 folhas = 12 un. A progressão também aparece no relatório de 4 folhas (16 un), mas ainda deve ser homologada no Atlas.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','NYL190','descricao','Botão de nylon fixação do arremate','cor','PRETO','unidade','UN','formula_quantidade','15','quantidade_referencia',15,'status','referencia','composicao_calculo','15 un no PDF. Componente ligado ao arremate; regra por perímetro/espaçamento ainda não identificada.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','NYL332','descricao','Guia deslizante com placa','cor','PRETO','unidade','UN','formula_quantidade','4 * 3','quantidade_referencia',12,'status','em_validacao','composicao_calculo','4 guias por folha × 3 folhas = 12 un; relatório de 4 folhas retorna 16 un.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','NYL335','descricao','Vedação superior','cor','PRETO','unidade','UN','formula_quantidade','3 - 1','quantidade_referencia',2,'status','em_validacao','composicao_calculo','3 folhas − 1 = 2 un; relatório de 4 folhas retorna 3 un.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','NYL357','descricao','Tampa da mão de amigo','cor','PRETO','unidade','UN','formula_quantidade','2 * (3 - 1)','quantidade_referencia',4,'status','em_validacao','composicao_calculo','2 tampas × (3 folhas − 1 encontro) = 4 un; relatório de 4 folhas retorna 6 un.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','NYL414','descricao','Batedeira BAT-FLEX','cor','PRETO','unidade','UN','formula_quantidade','4 * (3 - 1)','quantidade_referencia',8,'status','em_validacao','composicao_calculo','4 un × (3 folhas − 1 encontro) = 8 un; relatório de 4 folhas retorna 12 un.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','PAR1023','descricao','Parafuso AA CP 3,9 x 9,5 mm inox','cor','NATURAL','unidade','UN','formula_quantidade','12','quantidade_referencia',12,'status','referencia','composicao_calculo','12 un no relatório PC3 e também no relatório comparativo de 4 folhas; manter como fixo em validação até identificar a aplicação exata.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','PAR1025','descricao','Parafuso AA CP 4,2 x 16 mm inox','cor','NATURAL','unidade','UN','formula_quantidade','15','quantidade_referencia',15,'status','referencia','composicao_calculo','15 un no PDF. Regra ligada à montagem/fixação ainda pendente de decomposição.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','PAR435','descricao','Parafuso AA CP PP 4,8 x 32 mm inox','cor','NATURAL','unidade','UN','formula_quantidade','8 * 3','quantidade_referencia',24,'status','em_validacao','composicao_calculo','8 parafusos por folha × 3 folhas = 24 un; relatório de 4 folhas retorna 32 un.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','RPCS100','descricao','Roldana simples côncava Suprema/Mega 25 - carga 100 kg','cor','NATURAL','unidade','UN','formula_quantidade','2 * 3','quantidade_referencia',6,'status','em_validacao','composicao_calculo','2 roldanas por folha × 3 folhas = 6 un; relatório de 4 folhas retorna 8 un.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','SIL-PU','descricao','Silicone de poliuretano','cor','PRETO','unidade','TB','formula_quantidade','','quantidade_referencia',1.51733,'status','referencia','composicao_calculo','O PDF informa 1,51733 tubo. A taxa de consumo/conversão para tubos não está exposta no relatório e precisa ser descoberta antes da automação.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16')
),
observacoes = concat_ws(E'\n', nullif(f.observacoes,''), 'Acessórios PC3: base W.Vetro orçamento 835, relatório 14/07/26 22:27:16. Fórmulas não comprovadas em segunda medida permanecem em validação/referência.'),
updated_at = now()
from public.tipologias t
where f.tipologia_id = t.id
  and t.chave = 'l_suprema_porta_de_correr_03_folhas'
  and f.configuracao_chave = 'legado_wvetro_994'
  and (f.acessorios is null or jsonb_array_length(f.acessorios) = 0);

commit;
