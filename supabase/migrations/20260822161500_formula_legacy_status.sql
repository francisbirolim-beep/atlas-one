-- O ALTER TABLE aplicou o default em_desenvolvimento à linha PC3 já existente.
-- Ela continua operacional/ativa por compatibilidade, mas seu status editorial
-- deve refletir o estado técnico real: ainda em validação.

update public.engenharia_tipologia_formulas_corte
set status = 'em_validacao',
    updated_at = now()
where configuracao_chave = 'legado_wvetro_994'
  and status = 'em_desenvolvimento';
