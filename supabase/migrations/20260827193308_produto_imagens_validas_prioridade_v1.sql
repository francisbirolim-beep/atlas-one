update public.produto_imagens
set ativo = false,
    status_validacao = 'rejeitada',
    updated_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('motivo_rejeicao','URL genérica/placeholder sem imagem técnica utilizável')
where ativo = true
  and (
    trim(trailing '/' from lower(trim(url))) = 'https://api.wvetro.com.br/wvetro'
    or lower(url) like '%/nofoto.%'
    or lower(url) like '%/nofoto/%'
  );

with melhor as (
  select distinct on (pi.produto_id)
         pi.produto_id,
         pi.url
  from public.produto_imagens pi
  where pi.ativo = true
    and pi.status_validacao <> 'rejeitada'
    and trim(pi.url) <> ''
    and trim(trailing '/' from lower(trim(pi.url))) <> 'https://api.wvetro.com.br/wvetro'
    and lower(pi.url) not like '%/nofoto.%'
    and lower(pi.url) not like '%/nofoto/%'
  order by pi.produto_id,
           pi.principal desc,
           case when pi.status_validacao = 'validada' then 0 else 1 end,
           case pi.tipo when 'desenho_tecnico' then 0 when 'imagem_wvetro' then 1 when 'foto' then 2 else 3 end,
           pi.created_at desc
)
update public.produtos p
set foto_url = m.url,
    updated_at = now()
from melhor m
where p.id = m.produto_id
  and (
    p.foto_url is null
    or trim(p.foto_url) = ''
    or trim(trailing '/' from lower(trim(p.foto_url))) = 'https://api.wvetro.com.br/wvetro'
    or lower(p.foto_url) like '%/nofoto.%'
    or lower(p.foto_url) like '%/nofoto/%'
  );

update public.produtos
set foto_url = null,
    updated_at = now()
where foto_url is not null
  and (
    trim(trailing '/' from lower(trim(foto_url))) = 'https://api.wvetro.com.br/wvetro'
    or lower(foto_url) like '%/nofoto.%'
    or lower(foto_url) like '%/nofoto/%'
  );
