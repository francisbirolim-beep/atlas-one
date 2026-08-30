alter table public.tipologias drop constraint if exists tipologias_categoria_check;

update public.tipologias
set categoria = case
  when chave like '%acm%' then 'acm'
  when chave like '%ripad%' or chave like '%lambri%' then 'painel_ripado'
  when chave like '%fachada%' or chave like '%pele_de_vidro%' or chave like '%structural%' then 'fachada'
  when chave like '%guarda_corpo%' or chave like '%corrimao%' then 'guarda_corpo_corrimao'
  when chave like '%portao%' or chave like '%grade%' then 'portao_grade'
  when chave like '%box%' then 'box'
  when chave like '%cobertura%' or chave like '%claraboia%' then 'cobertura_claraboia'
  when chave like '%contramarco%' or chave like '%arremate%' then 'contramarco_arremate'
  when chave like '%espelho%' then 'espelho'
  when chave like '%mosquite%' then 'tela_mosquiteira'
  when chave like '%muro_de_vidro%' or chave like '%vidro_comum%' or chave like '%vidro_temperado%' or chave like '%prateleira%' then 'vidro'
  when chave like '%modulo_fixo%' or chave like '%_fixo%' then 'modulo_fixo'
  when chave like '%porta%' or chave like '%portinhola%' then 'porta'
  when chave like '%janela%' or chave like '%vitro%' or chave like '%maxim%' or chave like '%bascul%' or chave like '%guilhotina%' then 'janela'
  else 'outros'
end
where ativo = true;

alter table public.tipologias
  add constraint tipologias_categoria_check
  check (categoria = any (array[
    'porta'::text,
    'janela'::text,
    'modulo_fixo'::text,
    'fachada'::text,
    'box'::text,
    'painel_ripado'::text,
    'acm'::text,
    'cobertura_claraboia'::text,
    'contramarco_arremate'::text,
    'espelho'::text,
    'portao_grade'::text,
    'guarda_corpo_corrimao'::text,
    'vidro'::text,
    'tela_mosquiteira'::text,
    'outros'::text
  ]));
