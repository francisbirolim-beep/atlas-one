-- Complementa o mesmo modelo técnico V1; não ativa a receita para produção.
update public.engenharia_tipologia_formulas_corte f set
  variaveis = f.variaveis || '[
    {"chave":"montante_lateral","label":"Montante lateral móvel","opcoes":["largo","estreito"]},
    {"chave":"puxador","label":"Puxador","opcoes":["sem","sim"]},
    {"chave":"cor","label":"Cor","opcoes":[]},
    {"chave":"vidro","label":"Vidro","opcoes":[]}
  ]'::jsonb,
  metadados_editor = f.metadados_editor || '{"dimensoes":["L","H","quantidade"],"versao_receita":1}'::jsonb,
  ativo = false, status = 'em_validacao', updated_at = now()
where f.configuracao_chave = 'pc2_suprema_editor_v1'
  and not exists (select 1 from jsonb_array_elements(f.variaveis) v where v->>'chave'='montante_lateral');
