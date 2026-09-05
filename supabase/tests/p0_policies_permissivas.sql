do $$
declare v_count integer;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname='public'
    and (
      policyname ilike '%tempor%'
      or (cmd='ALL' and roles::text like '%public%' and coalesce(qual,'')='true')
      or (coalesce(qual,'')='true' and coalesce(with_check,'')='true')
    );
  if v_count<>0 then raise exception 'Ainda existem % policies permissivas/temporárias',v_count; end if;

  if exists(select 1 from information_schema.columns where table_schema='public' and table_name in ('permissoes','usuario_cadastros_360_permissoes','eventos','evento_convidados','linha_produtos','produto_linhas') and column_name='empresa_id' and is_nullable='YES') then
    raise exception 'Tabela crítica voltou a permitir empresa_id nulo';
  end if;

  if to_regprocedure('public.is_master_atlas()') is not null then raise exception 'Helper público is_master_atlas voltou a existir'; end if;
  if to_regprocedure('public.is_dono_evento(uuid)') is not null then raise exception 'Helper público is_dono_evento voltou a existir'; end if;
  if to_regprocedure('public.is_convidado_evento(uuid)') is not null then raise exception 'Helper público is_convidado_evento voltou a existir'; end if;

  if exists(select 1 from public.linha_produtos lp join public.produtos p on p.id=lp.produto_id where lp.empresa_id is distinct from p.empresa_id) then
    raise exception 'linha_produtos possui empresa divergente do produto';
  end if;
  if exists(select 1 from public.produto_linhas pl join public.produtos p on p.id=pl.produto_id where pl.empresa_id is distinct from p.empresa_id) then
    raise exception 'produto_linhas possui empresa divergente do produto';
  end if;
end $$;

select 'P0_POLICIES_PERMISSIVAS_OK' as resultado;
