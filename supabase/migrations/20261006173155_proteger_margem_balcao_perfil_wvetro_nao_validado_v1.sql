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
          case
            when p.origem='wvetro'
             and p.status_validacao='importado'
             and p.validado_em is null
            then case
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
            else coalesce(
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
          end
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
is 'Aplica margem de balcão. Perfis W.Vetro importados e não validados usam somente peso x barra x preço/kg configurado; custo histórico/legado não é aceito como base.';
