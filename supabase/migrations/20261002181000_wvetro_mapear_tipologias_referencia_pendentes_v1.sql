-- Completa o mapeamento das cinco referencias W.Vetro ainda sem tipologia Atlas.
-- A linha HYSPEX permanece com o status operacional atual; esta migration nao reativa linhas.
with pendentes as (
  select *
  from public.wvetro_referencias_tipologias
  where tipologia_atlas_id is null
    and (
      (upper(trim(linha_raw)) = 'ASA | MEGA 20' and upper(trim(modelo_raw)) in ('JANELA DE CORRER 02 FOLHAS','JANELA DE CORRER 04 FOLHAS'))
      or (upper(trim(linha_raw)) = 'HYSPEX | LINHA 16 HIPER MODULAR' and upper(trim(modelo_raw)) in ('JANELA DE CORRER 02 FOLHAS','JANELA DE CORRER 03 FOLHAS'))
      or (upper(trim(linha_raw)) = 'L. VIDRO TEMPERADO' and upper(trim(modelo_raw)) = 'BASCULANTE')
    )
),
normalizados as (
  select p.*,
    case
      when upper(trim(linha_raw)) = 'ASA | MEGA 20' and upper(trim(modelo_raw)) = 'JANELA DE CORRER 02 FOLHAS' then 'asa_mega_20_janela_de_correr_02_folhas'
      when upper(trim(linha_raw)) = 'ASA | MEGA 20' and upper(trim(modelo_raw)) = 'JANELA DE CORRER 04 FOLHAS' then 'asa_mega_20_janela_de_correr_04_folhas'
      when upper(trim(linha_raw)) = 'HYSPEX | LINHA 16 HIPER MODULAR' and upper(trim(modelo_raw)) = 'JANELA DE CORRER 02 FOLHAS' then 'hyspex_linha_16_hiper_modular_janela_de_correr_02_folhas'
      when upper(trim(linha_raw)) = 'HYSPEX | LINHA 16 HIPER MODULAR' and upper(trim(modelo_raw)) = 'JANELA DE CORRER 03 FOLHAS' then 'hyspex_linha_16_hiper_modular_janela_de_correr_03_folhas'
      when upper(trim(linha_raw)) = 'L. VIDRO TEMPERADO' and upper(trim(modelo_raw)) = 'BASCULANTE' then 'l_vidro_temperado_basculante'
    end as chave_atlas
  from pendentes p
)
insert into public.tipologias (
  chave,label,categoria,ativo,origem_referencia,linha_origem_wvetro,modelo_origem_wvetro,
  foto_url,wvetro_primeiro_visto,wvetro_ultimo_visto,wvetro_ocorrencias,usa_vidro
)
select
  n.chave_atlas,
  initcap(lower(trim(n.modelo_raw))) || ' (' || initcap(lower(trim(n.linha_raw))) || ')',
  'janela',
  true,
  'wvetro',
  trim(n.linha_raw),
  trim(n.modelo_raw),
  n.imagem_url,
  n.primeiro_visto,
  n.ultimo_visto,
  n.ocorrencias,
  true
from normalizados n
where n.chave_atlas is not null
on conflict (chave) do update set
  origem_referencia='wvetro',
  linha_origem_wvetro=excluded.linha_origem_wvetro,
  modelo_origem_wvetro=excluded.modelo_origem_wvetro,
  foto_url=coalesce(public.tipologias.foto_url,excluded.foto_url),
  wvetro_primeiro_visto=coalesce(public.tipologias.wvetro_primeiro_visto,excluded.wvetro_primeiro_visto),
  wvetro_ultimo_visto=greatest(public.tipologias.wvetro_ultimo_visto,excluded.wvetro_ultimo_visto),
  wvetro_ocorrencias=greatest(coalesce(public.tipologias.wvetro_ocorrencias,0),coalesce(excluded.wvetro_ocorrencias,0));
update public.wvetro_referencias_tipologias r
set tipologia_atlas_id=t.id, status_mapeamento='mapeada_exata', updated_at=now()
from public.tipologias t
where r.tipologia_atlas_id is null
  and t.origem_referencia='wvetro'
  and upper(trim(t.linha_origem_wvetro))=upper(trim(r.linha_raw))
  and upper(trim(t.modelo_origem_wvetro))=upper(trim(r.modelo_raw));

insert into public.linha_tipologias (linha_id,tipologia_id)
select distinct l.id,r.tipologia_atlas_id
from public.wvetro_referencias_tipologias r
join public.linhas_tecnicas l on upper(trim(l.nome))=upper(trim(r.linha_raw))
where r.tipologia_atlas_id is not null
  and r.status_mapeamento='mapeada_exata'
on conflict (linha_id,tipologia_id) do nothing;