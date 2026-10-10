update public.engenharia_tipologia_formulas_corte
set status = 'em_validacao',
    updated_at = now()
where configuracao_chave = 'legado_wvetro_994'
  and status = 'em_desenvolvimento';