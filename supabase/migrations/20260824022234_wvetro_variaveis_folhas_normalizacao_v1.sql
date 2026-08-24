-- Normaliza valores explícitos W.Vetro e amplia somente termos escritos no próprio Modelo.
delete from public.engenharia_variavel_opcoes o
using public.engenharia_variaveis v
where o.variavel_id=v.id and v.chave='folhas' and o.chave ~ '^0[0-9]+$';

create or replace function public.fn_wvetro_reconstruir_variaveis_explicitas()
returns integer language plpgsql security invoker set search_path=public as $$
declare v_count integer := 0;
begin
  delete from public.wvetro_referencias_variaveis where origem_tipo='explicita_wvetro';

  with candidatos as (
    select r.id ref_id,r.tipologia_atlas_id,'folhas' chave,'Número de folhas' label,
           ((regexp_match(r.modelo_raw,'([0-9]{1,2})[[:space:]]*folhas?','i'))[1]::integer)::text valor,
           r.linha_raw,r.modelo_raw
    from public.wvetro_referencias_tipologias r
    where regexp_match(r.modelo_raw,'([0-9]{1,2})[[:space:]]*folhas?','i') is not null
    union all
    select r.id,r.tipologia_atlas_id,'montagem','Montagem',
           case when lower(r.modelo_raw) like '%abertura central%' then 'abertura_central'
                when lower(r.modelo_raw) ~ 'fixa.*m[oó]vel|m[oó]vel.*fixa' then 'fixa_movel'
                when lower(r.modelo_raw) ~ 'todas m[oó]veis' then 'todas_moveis'
                when lower(r.modelo_raw) like '%sequencial%' then 'sequencial'
                when lower(r.modelo_raw) like '%canto%' then 'canto' end,
           r.linha_raw,r.modelo_raw
    from public.wvetro_referencias_tipologias r
    where lower(r.modelo_raw) like '%abertura central%' or lower(r.modelo_raw) ~ 'fixa.*m[oó]vel|m[oó]vel.*fixa|todas m[oó]veis' or lower(r.modelo_raw) like '%sequencial%' or lower(r.modelo_raw) like '%canto%'
    union all
    select r.id,r.tipologia_atlas_id,'trilho','Trilho',
           case when lower(r.modelo_raw) ~ 'macarr[aã]o|embutir|embutido' then 'embutir' when lower(r.modelo_raw) like '%convencional%' then 'convencional' end,
           r.linha_raw,r.modelo_raw
    from public.wvetro_referencias_tipologias r
    where lower(r.modelo_raw) ~ 'macarr[aã]o|embutir|embutido' or lower(r.modelo_raw) like '%convencional%'
    union all
    select r.id,r.tipologia_atlas_id,'contramarco','Contramarco',case when lower(r.modelo_raw) like '%sem contramarco%' then 'nao' else 'sim' end,r.linha_raw,r.modelo_raw
    from public.wvetro_referencias_tipologias r where lower(r.modelo_raw) like '%sem contramarco%' or lower(r.modelo_raw) like '%com contramarco%'
    union all
    select r.id,r.tipologia_atlas_id,'arremate','Arremate',case when lower(r.modelo_raw) like '%sem arremate%' then 'sem' else 'face_interna' end,r.linha_raw,r.modelo_raw
    from public.wvetro_referencias_tipologias r where lower(r.modelo_raw) like '%sem arremate%' or lower(r.modelo_raw) like '%arremate face interna%'
    union all
    select r.id,r.tipologia_atlas_id,'fechadura','Fechadura',case when lower(r.modelo_raw) like '%sem fechadura%' then 'nao' else 'sim' end,r.linha_raw,r.modelo_raw
    from public.wvetro_referencias_tipologias r where lower(r.modelo_raw) like '%sem fechadura%' or lower(r.modelo_raw) like '%com fechadura%'
    union all
    select r.id,r.tipologia_atlas_id,'puxador','Puxador',case when lower(r.modelo_raw) like '%sem puxador%' then 'nao' else 'sim' end,r.linha_raw,r.modelo_raw
    from public.wvetro_referencias_tipologias r where lower(r.modelo_raw) like '%sem puxador%' or lower(r.modelo_raw) like '%com puxador%'
    union all
    select r.id,r.tipologia_atlas_id,'mao_amiga','Mão de amigo',case when lower(r.modelo_raw) ~ 'm[aã]o amiga larga' then 'largo' else 'comum' end,r.linha_raw,r.modelo_raw
    from public.wvetro_referencias_tipologias r where lower(r.modelo_raw) ~ 'm[aã]o amiga'
    union all
    select r.id,r.tipologia_atlas_id,'reforco','Reforço',case when lower(r.modelo_raw) ~ 'refor[cç]o interno' then 'interno' when lower(r.modelo_raw) ~ 'refor[cç]o externo' then 'externo' else 'sem' end,r.linha_raw,r.modelo_raw
    from public.wvetro_referencias_tipologias r where lower(r.modelo_raw) ~ 'refor[cç]o interno|refor[cç]o externo|sem refor[cç]o'
    union all
    select r.id,r.tipologia_atlas_id,'roldana','Roldana',case when lower(r.modelo_raw) ~ '200[[:space:]]*kg' then '200kg' else '100kg' end,r.linha_raw,r.modelo_raw
    from public.wvetro_referencias_tipologias r where lower(r.modelo_raw) ~ '(100|200)[[:space:]]*kg'
  )
  insert into public.wvetro_referencias_variaveis (
    referencia_tipologia_id,tipologia_atlas_id,variavel_atlas_id,
    variavel_chave_raw,variavel_label_raw,valor_raw,valor_normalizado,
    origem_tipo,confianca,evidencia,status_mapeamento,dados_origem,updated_at
  )
  select c.ref_id,c.tipologia_atlas_id,v.id,c.chave,c.label,c.valor,c.valor,
         'explicita_wvetro',1.0000,'Modelo W.Vetro: '||c.modelo_raw,
         case when v.id is not null then 'mapeada_exata' else 'referencia' end,
         jsonb_build_object('campo','Modelo','linha',c.linha_raw,'modelo',c.modelo_raw),now()
  from candidatos c
  left join public.engenharia_variaveis v on v.chave=c.chave
  where c.valor is not null
  on conflict do nothing;
  get diagnostics v_count = row_count;

  insert into public.engenharia_variavel_opcoes (variavel_id,chave,label,ordem)
  select v.id,x.valor,x.valor||case when x.valor='1' then ' folha' else ' folhas' end,10+x.valor::integer
  from public.engenharia_variaveis v
  join (select distinct valor_normalizado valor from public.wvetro_referencias_variaveis where variavel_chave_raw='folhas' and valor_normalizado ~ '^[0-9]{1,2}$') x on true
  where v.chave='folhas'
    and not exists (select 1 from public.engenharia_variavel_opcoes o where o.variavel_id=v.id and o.chave=x.valor);

  insert into public.engenharia_variavel_opcoes (variavel_id,chave,label,ordem)
  select v.id,x.chave,x.label,x.ordem
  from public.engenharia_variaveis v
  cross join (values ('abertura_central','Abertura central',3),('sequencial','Sequencial',4),('canto','Canto',5)) x(chave,label,ordem)
  where v.chave='montagem'
    and not exists (select 1 from public.engenharia_variavel_opcoes o where o.variavel_id=v.id and o.chave=x.chave);

  return v_count;
end; $$;

revoke execute on function public.fn_wvetro_reconstruir_variaveis_explicitas() from public, anon, authenticated;
grant execute on function public.fn_wvetro_reconstruir_variaveis_explicitas() to service_role;
select public.fn_wvetro_reconstruir_variaveis_explicitas();
