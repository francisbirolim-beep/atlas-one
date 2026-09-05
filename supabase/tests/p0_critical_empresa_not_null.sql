do $$
declare v_count integer;
begin
  select count(*) into v_count
  from information_schema.columns
  where table_schema='public'
    and column_name='empresa_id'
    and table_name in ('usuarios','assistencias','balcao_pagamentos','ordens_producao','pacotes_tecnicos')
    and is_nullable='YES';
  if v_count <> 0 then
    raise exception 'Há estruturas críticas com empresa_id nullable: %', v_count;
  end if;
end $$;
select 'P0_CRITICAL_EMPRESA_NOT_NULL_OK' as resultado;
