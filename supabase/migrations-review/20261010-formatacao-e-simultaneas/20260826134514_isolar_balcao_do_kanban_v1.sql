insert into public.kanban_colunas (nome, ordem, cor, gera_medicao_final)
select '__BALCAO_INTERNO__', 999999, '#64748b', false
where not exists (
  select 1 from public.kanban_colunas where nome='__BALCAO_INTERNO__'
);

update public.orcamentos
set coluna_id = (select id from public.kanban_colunas where nome='__BALCAO_INTERNO__' limit 1),
    coluna_atualizada_em = null
where modo_entrada='balcao';
