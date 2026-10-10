-- Corrige custos operacionais de perfis preenchidos indevidamente com CustoVlr
-- total observado em itens históricos do W.Vetro.
-- Preserva custo_wvetro_* como evidência e qualquer item validado/manual.

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
      * (coalesce(p.tamanho_barra_mm, p.tamanho_barra_mm_origem) / 1000.0)
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
    and (
      p.custo=p.custo_wvetro_ultimo
      or p.custo=p.custo_wvetro_max
      or p.custo=p.custo_wvetro_min
    )
    and p.peso_kg_m>0
    and coalesce(p.tamanho_barra_mm,p.tamanho_barra_mm_origem,0)>0
    and (cfg.preco_kg + cfg.pintura_kg)>0
)
update public.produtos p
set
  custo = a.custo_barra,
  dados_origem = coalesce(p.dados_origem,'{}'::jsonb) || jsonb_build_object(
    'correcao_custo_perfil_wvetro_20261006',
    jsonb_build_object(
      'custo_anterior', a.custo_anterior,
      'custo_barra_calculado', a.custo_barra,
      'regra', 'peso_kg_m x tamanho_barra_m x (preco_kg_aluminio + custo_pintura_kg)',
      'motivo', 'CustoVlr histórico do W.Vetro representa o custo total do componente usado, não o custo unitário da barra.'
    )
  ),
  updated_at = now()
from alvos a
where p.id=a.id;

create or replace function public.aplicar_margem_balcao_produtos(
  p_margem numeric,
  p_categoria text default null,
  p_linha_id uuid default null,
  p_status text default 'ativos'
) returns integer
language plpgsql
set search_path=public
as $$
declare
  v_atualizados integer := 0;
  v_preco_kg numeric := 0;
  v_pintura_kg numeric := 0;
begin
  if p_margem is null or p_margem < 0 or p_margem >= 100 then
    raise exception 'Margem deve estar entre 0 e menos de 100';
  end if;

  select
    coalesce(max(valor::numeric) filter (where chave='preco_kg_aluminio'),0),
    coalesce(max(valor::numeric) filter (where chave='custo_pintura_kg'),0)
  into v_preco_kg, v_pintura_kg
  from public.configuracoes_precificacao;

  with base as (
    select
      p.id,
      case
        when p.categoria='perfil' then
          coalesce(
            nullif(p.custo,0),
            case
              when coalesce(p.peso_kg_m,0)>0
               and coalesce(p.tamanho_barra_mm,p.tamanho_barra_mm_origem,0)>0
               and (v_preco_kg + v_pintura_kg)>0
              then round(
                p.peso_kg_m
                * (coalesce(p.tamanho_barra_mm,p.tamanho_barra_mm_origem)/1000.0)
                * (v_preco_kg + v_pintura_kg),
                2
              )
              else null
            end
          )
        else
          coalesce(p.custo,p.custo_wvetro_ultimo,p.custo_wvetro_max,p.custo_wvetro_min)
      end as custo_base
    from public.produtos p
    where (p_categoria is null or p.categoria=p_categoria)
      and (p_linha_id is null or p.linha_id=p_linha_id)
      and (
        p_status='todos'
        or (p_status='ativos' and p.ativo=true)
        or (p_status='inativos' and p.ativo=false)
      )
  )
  update public.produtos p
     set margem_percentual=p_margem,
         preco=round(base.custo_base/(1-p_margem/100.0),2),
         updated_at=now()
    from base
   where p.id=base.id
     and base.custo_base>0;

  get diagnostics v_atualizados=row_count;
  return v_atualizados;
end;
$$;

comment on function public.aplicar_margem_balcao_produtos(numeric,text,uuid,text)
is 'Aplica margem de balcão. Para perfis, nunca usa CustoVlr histórico W.Vetro como fallback: usa custo operacional ou custo da barra por peso x comprimento x preço/kg configurado.';
