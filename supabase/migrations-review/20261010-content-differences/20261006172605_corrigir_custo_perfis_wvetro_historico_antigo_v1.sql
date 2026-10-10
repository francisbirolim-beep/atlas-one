-- Segunda passagem para custos preenchidos pelo histórico em estado anterior.
-- Só corrige custo que ainda coincide exatamente com alguma evidência W.Vetro.

with cfg as (
  select
    coalesce(max(valor::numeric) filter (where chave='preco_kg_aluminio'), 0) as preco_kg,
    coalesce(max(valor::numeric) filter (where chave='custo_pintura_kg'), 0) as pintura_kg
  from public.configuracoes_precificacao
),
alvos as (
  select
    p.id,
    p.custo as custo_anterior,
    round(
      p.peso_kg_m
      * (coalesce(p.tamanho_barra_mm,p.tamanho_barra_mm_origem)/1000.0)
      * (cfg.preco_kg + cfg.pintura_kg),
      2
    ) as custo_barra
  from public.produtos p
  cross join cfg
  where p.categoria='perfil'
    and p.ativo=true
    and p.origem='wvetro'
    and p.status_validacao='importado'
    and p.validado_em is null
    and coalesce(p.custo,0)>0
    and not (coalesce(p.dados_origem,'{}'::jsonb) ? 'correcao_custo_perfil_wvetro_20261006')
    and p.peso_kg_m>0
    and coalesce(p.tamanho_barra_mm,p.tamanho_barra_mm_origem,0)>0
    and (cfg.preco_kg + cfg.pintura_kg)>0
    and (
      exists (
        select 1
        from public.wvetro_tipologia_componentes w
        where w.produto_atlas_id=p.id
          and (w.custo_min=p.custo or w.custo_max=p.custo or w.custo_ultimo=p.custo)
      )
      or exists (
        select 1
        from public.wvetro_referencias_componentes r
        where r.produto_atlas_id=p.id
          and (r.custo_min=p.custo or r.custo_max=p.custo)
      )
    )
)
update public.produtos p
set
  custo=a.custo_barra,
  dados_origem=coalesce(p.dados_origem,'{}'::jsonb) || jsonb_build_object(
    'correcao_custo_perfil_wvetro_20261006',
    jsonb_build_object(
      'custo_anterior',a.custo_anterior,
      'custo_barra_calculado',a.custo_barra,
      'regra','peso_kg_m x tamanho_barra_m x (preco_kg_aluminio + custo_pintura_kg)',
      'motivo','Custo operacional coincidia com evidência histórica W.Vetro de CustoVlr total do componente.'
    )
  ),
  updated_at=now()
from alvos a
where p.id=a.id;
