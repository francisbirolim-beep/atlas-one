-- Reconcilia de forma idempotente os quatro últimos itens da carga PC3.
-- Em ambientes novos, remove/reinsere os mesmos itens sem duplicar.

with alvo as (
  select f.id,
         coalesce((
           select jsonb_agg(elem)
           from jsonb_array_elements(f.acessorios) elem
           where coalesce(elem->>'codigo','') not in ('PAR1025','PAR435','RPCS100','SIL-PU')
             and not (elem ? 'PAR1025')
         ), '[]'::jsonb) as base
  from public.engenharia_tipologia_formulas_corte f
  join public.tipologias t on t.id = f.tipologia_id
  where t.chave = 'l_suprema_porta_de_correr_03_folhas'
    and f.configuracao_chave = 'legado_wvetro_994'
)
update public.engenharia_tipologia_formulas_corte f
set acessorios = alvo.base || jsonb_build_array(
  jsonb_build_object('codigo','PAR1025','descricao','Parafuso AA CP 4,2 x 16 mm inox','cor','NATURAL','unidade','UN','formula_quantidade','15','quantidade_referencia',15,'status','referencia','composicao_calculo','15 un no PDF. Regra ligada à montagem/fixação ainda pendente de decomposição.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','PAR435','descricao','Parafuso AA CP PP 4,8 x 32 mm inox','cor','NATURAL','unidade','UN','formula_quantidade','8 * 3','quantidade_referencia',24,'status','em_validacao','composicao_calculo','8 parafusos por folha × 3 folhas = 24 un; relatório de 4 folhas retorna 32 un.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','RPCS100','descricao','Roldana simples côncava Suprema/Mega 25 - carga 100 kg','cor','NATURAL','unidade','UN','formula_quantidade','2 * 3','quantidade_referencia',6,'status','em_validacao','composicao_calculo','2 roldanas por folha × 3 folhas = 6 un; relatório de 4 folhas retorna 8 un.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16'),
  jsonb_build_object('codigo','SIL-PU','descricao','Silicone de poliuretano','cor','PRETO','unidade','TB','formula_quantidade','','quantidade_referencia',1.51733,'status','referencia','composicao_calculo','O PDF informa 1,51733 tubo. A taxa de consumo/conversão para tubos não está exposta no relatório e precisa ser descoberta antes da automação.','fonte','W.Vetro orçamento 835 · Relatório de Acessórios · 14/07/26 22:27:16')
), updated_at = now()
from alvo
where f.id = alvo.id;
