-- Preserva a medida originalmente orçada em cada posição da Medida Final.
-- Isso mantém a referência mesmo quando novas tipologias são adicionadas depois.

alter table public.medicao_itens
  add column if not exists orcamento_largura_mm numeric,
  add column if not exists orcamento_altura_mm numeric;

with origem as (
  select
    mi.id,
    case
      when coalesce(j.item->>'largura_mm', '') ~ '^[0-9]+([.,][0-9]+)?$'
        then replace(j.item->>'largura_mm', ',', '.')::numeric
      else null
    end as largura_mm,
    case
      when coalesce(j.item->>'altura_mm', '') ~ '^[0-9]+([.,][0-9]+)?$'
        then replace(j.item->>'altura_mm', ',', '.')::numeric
      else null
    end as altura_mm
  from public.medicoes_finais mf
  join public.orcamentos o on o.id = mf.orcamento_id
  join public.medicao_itens mi on mi.medicao_id = mf.id
  cross join lateral jsonb_array_elements(coalesce(o.itens, '[]'::jsonb))
    with ordinality as j(item, ord)
  where mi.ordem = j.ord - 1
    and mi.tipo_esquadria = coalesce(j.item->>'tipo_esquadria', mi.tipo_esquadria)
    and mi.quantidade = case
      when coalesce(j.item->>'quantidade', '') ~ '^[0-9]+)
update public.medicao_itens mi
set
  orcamento_largura_mm = coalesce(mi.orcamento_largura_mm, origem.largura_mm),
  orcamento_altura_mm = coalesce(mi.orcamento_altura_mm, origem.altura_mm)
from origem
where mi.id = origem.id
  and (mi.orcamento_largura_mm is null or mi.orcamento_altura_mm is null);

        then (j.item->>'quantidade')::integer
      else 1
    end
)
update public.medicao_itens mi
set
  orcamento_largura_mm = coalesce(mi.orcamento_largura_mm, origem.largura_mm),
  orcamento_altura_mm = coalesce(mi.orcamento_altura_mm, origem.altura_mm)
from origem
where mi.id = origem.id
  and (mi.orcamento_largura_mm is null or mi.orcamento_altura_mm is null);
