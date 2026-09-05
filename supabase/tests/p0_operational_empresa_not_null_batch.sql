do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from information_schema.columns
  where table_schema='public'
    and column_name='empresa_id'
    and table_name in (
      'kanban_colunas','assistencia_colunas','unidades_operacionais','tarefas',
      'medicao_fotos','medicao_respostas','medicao_pendencias','medicao_revisoes',
      'financeiro_recebimentos','financeiro_recebimento_alocacoes'
    )
    and is_nullable <> 'NO';

  if v_count <> 0 then
    raise exception 'P0 regression: % colunas empresa_id voltaram a aceitar NULL', v_count;
  end if;

  raise notice 'P0_OPERATIONAL_EMPRESA_NOT_NULL_OK';
end $$;
