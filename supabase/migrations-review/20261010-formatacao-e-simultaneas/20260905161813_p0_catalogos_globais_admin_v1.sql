do $$
declare t text;
begin
  foreach t in array array['cores','linhas','linhas_tecnicas','linha_tipologias','tipologias','tipologia_campos_extras','engenharia_receitas','engenharia_receita_componentes','engenharia_tipologia_formulas_corte','engenharia_tipologia_variaveis','engenharia_variaveis','engenharia_variavel_opcoes','engenharia_componente_variantes','medicao_colunas'] loop
    execute format('drop policy if exists acesso_total_temporario on public.%I',t);
    execute format('drop policy if exists authenticated_full_access on public.%I',t);
    execute format('drop policy if exists engenharia_receitas_authenticated_all on public.%I',t);
    execute format('drop policy if exists engenharia_receita_componentes_authenticated_all on public.%I',t);
    execute format('drop policy if exists catalogo_global_select on public.%I',t);
    execute format('drop policy if exists catalogo_global_insert on public.%I',t);
    execute format('drop policy if exists catalogo_global_update on public.%I',t);
    execute format('drop policy if exists catalogo_global_delete on public.%I',t);
    execute format('create policy catalogo_global_select on public.%I for select to authenticated using (true)',t);
    execute format('create policy catalogo_global_insert on public.%I for insert to authenticated with check (private.is_bootstrap_platform_admin())',t);
    execute format('create policy catalogo_global_update on public.%I for update to authenticated using (private.is_bootstrap_platform_admin()) with check (private.is_bootstrap_platform_admin())',t);
    execute format('create policy catalogo_global_delete on public.%I for delete to authenticated using (private.is_bootstrap_platform_admin())',t);
  end loop;
end $$;
