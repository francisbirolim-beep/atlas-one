-- Remove croquis SVG gerados automaticamente na migration anterior.
--
-- Decisao de produto:
-- - o seletor visual deve exibir somente imagem real/validada Atlas ou imagem original W.Vetro;
-- - na ausencia de imagem real, usar placeholder neutro;
-- - croqui automatico nao pode parecer imagem oficial da tipologia.
--
-- Esta limpeza e deliberadamente restrita aos data URIs SVG presentes em tipologias
-- da Linha Suprema. Nenhuma URL externa/storage e alterada.

update public.tipologias t
set foto_url = null
where t.foto_url like 'data:image/svg+xml;base64,%'
  and exists (
    select 1
    from public.linha_tipologias lt
    join public.linhas_tecnicas l on l.id = lt.linha_id
    where lt.tipologia_id = t.id
      and upper(l.nome) = 'SUPREMA'
  );
