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