with t as (
  select c.relname tabela
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relrowsecurity
    and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
), prova as (
  select count(*) total_backend_only,
         count(*) filter(where has_table_privilege('authenticated',format('public.%I',tabela),'select') or has_table_privilege('authenticated',format('public.%I',tabela),'insert') or has_table_privilege('authenticated',format('public.%I',tabela),'update') or has_table_privilege('authenticated',format('public.%I',tabela),'delete')) authenticated_com_privilegio,
         count(*) filter(where not has_table_privilege('service_role',format('public.%I',tabela),'select')) service_sem_select
  from t
)
select case when authenticated_com_privilegio=0 and service_sem_select=0 then 'P0_BACKEND_ONLY_EXPLICIT_OK' else (1/0)::text end as resultado
from prova;
