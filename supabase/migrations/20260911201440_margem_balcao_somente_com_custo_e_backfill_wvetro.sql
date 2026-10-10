update public.produtos p
set custo = coalesce(p.custo_wvetro_ultimo, p.custo_wvetro_max, p.custo_wvetro_min),
    updated_at = now()
where coalesce(p.custo,0) <= 0
  and coalesce(p.custo_wvetro_ultimo, p.custo_wvetro_max, p.custo_wvetro_min) > 0;

with custos as (
  select produto_atlas_id,
         max(custo_ultimo) filter (where custo_ultimo > 0) as custo_ultimo,
         max(custo_max) filter (where custo_max > 0) as custo_max,
         min(custo_min) filter (where custo_min > 0) as custo_min
  from public.wvetro_tipologia_componentes
  where produto_atlas_id is not null
  group by produto_atlas_id
)
update public.produtos p
set custo = coalesce(c.custo_ultimo,c.custo_max,c.custo_min),
    custo_wvetro_ultimo = coalesce(p.custo_wvetro_ultimo,c.custo_ultimo),
    custo_wvetro_max = coalesce(p.custo_wvetro_max,c.custo_max),
    custo_wvetro_min = coalesce(p.custo_wvetro_min,c.custo_min),
    updated_at = now()
from custos c
where p.id=c.produto_atlas_id
  and coalesce(p.custo,0)<=0
  and coalesce(c.custo_ultimo,c.custo_max,c.custo_min)>0;

with refs as (
  select produto_atlas_id,
         max(custo_max) filter (where custo_max > 0) as custo_max,
         min(custo_min) filter (where custo_min > 0) as custo_min
  from public.wvetro_referencias_componentes
  where produto_atlas_id is not null
  group by produto_atlas_id
)
update public.produtos p
set custo = coalesce(r.custo_max,r.custo_min),
    custo_wvetro_max = coalesce(p.custo_wvetro_max,r.custo_max),
    custo_wvetro_min = coalesce(p.custo_wvetro_min,r.custo_min),
    updated_at = now()
from refs r
where p.id=r.produto_atlas_id
  and coalesce(p.custo,0)<=0
  and coalesce(r.custo_max,r.custo_min)>0;

update public.produtos p
set foto_url = s.imagem_atlas_url,
    updated_at = now()
from public.wvetro_produtos_snapshot s
where s.produto_atlas_id=p.id
  and s.imagem_atlas_url is not null
  and btrim(s.imagem_atlas_url)<>''
  and (p.foto_url is null or p.foto_url like '%api.wvetro.com.br%');

create or replace function public.aplicar_margem_balcao_produtos(
  p_margem numeric,
  p_categoria text default null,
  p_linha_id uuid default null,
  p_status text default 'ativos'
) returns integer
language plpgsql
set search_path=public
as $$
declare v_atualizados integer := 0;
begin
  if p_margem is null or p_margem < 0 or p_margem >= 100 then
    raise exception 'Margem deve estar entre 0 e menos de 100';
  end if;
  update public.produtos
     set margem_percentual=p_margem,
         preco=round(coalesce(custo,custo_wvetro_ultimo,custo_wvetro_max,custo_wvetro_min)/(1-p_margem/100.0),2),
         updated_at=now()
   where coalesce(custo,custo_wvetro_ultimo,custo_wvetro_max,custo_wvetro_min)>0
     and (p_categoria is null or categoria=p_categoria)
     and (p_linha_id is null or linha_id=p_linha_id)
     and (p_status='todos' or (p_status='ativos' and ativo=true) or (p_status='inativos' and ativo=false));
  get diagnostics v_atualizados=row_count;
  return v_atualizados;
end;
$$;