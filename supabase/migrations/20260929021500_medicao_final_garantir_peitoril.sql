-- Atlas One — garantir altura de peitoril no checklist da Medição Final
-- Corrige o seed antigo da v13, que só inseria os padrões quando a tabela
-- inteira estava vazia. Idempotente por tipologia + chave.

insert into public.tipologia_campos_extras
  (tipo_esquadria, chave, nome, tipo_valor, obrigatorio, ordem, secao, ativo)
select
  v.tipo_esquadria,
  'peitoril_mm',
  'Altura do peitoril (mm)',
  'numero',
  true,
  10,
  'Informações técnicas',
  true
from (values
  ('janela_correr'),
  ('janela_maximiar'),
  ('janela_basculante'),
  ('vitro')
) as v(tipo_esquadria)
where not exists (
  select 1
  from public.tipologia_campos_extras c
  where c.tipo_esquadria = v.tipo_esquadria
    and c.chave = 'peitoril_mm'
);

update public.tipologia_campos_extras
set
  nome = 'Altura do peitoril (mm)',
  tipo_valor = 'numero',
  obrigatorio = true,
  secao = coalesce(secao, 'Informações técnicas'),
  ativo = true
where chave = 'peitoril_mm'
  and tipo_esquadria in ('janela_correr', 'janela_maximiar', 'janela_basculante', 'vitro');
