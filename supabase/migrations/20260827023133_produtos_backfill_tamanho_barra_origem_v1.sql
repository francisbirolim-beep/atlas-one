update public.produtos
set tamanho_barra_mm = case
  when coalesce(tamanho_barra_mm_origem,0) > 0 then tamanho_barra_mm_origem
  when coalesce(dados_origem->>'tamanho_raw','') ~ '^[0-9]+([.][0-9]+)?$' then (dados_origem->>'tamanho_raw')::numeric
  else tamanho_barra_mm
end
where tamanho_barra_mm is null
  and (
    coalesce(tamanho_barra_mm_origem,0) > 0
    or coalesce(dados_origem->>'tamanho_raw','') ~ '^[0-9]+([.][0-9]+)?$'
  );
