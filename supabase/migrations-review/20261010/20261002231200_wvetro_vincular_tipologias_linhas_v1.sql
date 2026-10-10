-- Atlas One / W.Vetro — recompõe vínculos linha -> tipologia usando apenas
-- referências W.Vetro já mapeadas para IDs Atlas. Não cria linha/tipologia e
-- não altera receita, custo ou variável técnica.

insert into public.linha_tipologias (linha_id, tipologia_id)
select distinct
  rl.linha_tecnica_id,
  rt.tipologia_atlas_id
from public.wvetro_referencias_tipologias rt
join public.wvetro_referencias_linhas rl
  on lower(btrim(rl.linha_raw)) = lower(btrim(rt.linha_raw))
where rt.tipologia_atlas_id is not null
  and rl.linha_tecnica_id is not null
  and coalesce(rt.status_mapeamento, '') in ('mapeada_exata', 'validada_atlas', 'referencia')
  and not exists (
    select 1
    from public.linha_tipologias atual
    where atual.linha_id = rl.linha_tecnica_id
      and atual.tipologia_id = rt.tipologia_atlas_id
  );