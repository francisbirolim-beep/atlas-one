create or replace function private.is_bootstrap_company_member()
returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.usuarios u join public.empresas e on e.id=u.empresa_id where u.id=auth.uid() and e.ativo=true and lower(e.slug)='esquadrifacio');
$$;
revoke all on function private.is_bootstrap_company_member() from public,anon;
grant execute on function private.is_bootstrap_company_member() to authenticated,service_role;

drop policy if exists acesso_total_temporario on public.configuracoes_precificacao;
drop policy if exists bootstrap_precificacao_select on public.configuracoes_precificacao;
drop policy if exists bootstrap_precificacao_insert on public.configuracoes_precificacao;
drop policy if exists bootstrap_precificacao_update on public.configuracoes_precificacao;
drop policy if exists bootstrap_precificacao_delete on public.configuracoes_precificacao;
create policy bootstrap_precificacao_select on public.configuracoes_precificacao for select to authenticated using (private.is_bootstrap_company_member());
create policy bootstrap_precificacao_insert on public.configuracoes_precificacao for insert to authenticated with check (private.is_bootstrap_platform_admin());
create policy bootstrap_precificacao_update on public.configuracoes_precificacao for update to authenticated using (private.is_bootstrap_platform_admin()) with check (private.is_bootstrap_platform_admin());
create policy bootstrap_precificacao_delete on public.configuracoes_precificacao for delete to authenticated using (private.is_bootstrap_platform_admin());

drop policy if exists acesso_total_temporario on public.automacoes_setor;
drop policy if exists bootstrap_automacoes_select on public.automacoes_setor;
drop policy if exists bootstrap_automacoes_insert on public.automacoes_setor;
drop policy if exists bootstrap_automacoes_update on public.automacoes_setor;
drop policy if exists bootstrap_automacoes_delete on public.automacoes_setor;
create policy bootstrap_automacoes_select on public.automacoes_setor for select to authenticated using (private.is_bootstrap_company_member());
create policy bootstrap_automacoes_insert on public.automacoes_setor for insert to authenticated with check (private.is_bootstrap_platform_admin());
create policy bootstrap_automacoes_update on public.automacoes_setor for update to authenticated using (private.is_bootstrap_platform_admin()) with check (private.is_bootstrap_platform_admin());
create policy bootstrap_automacoes_delete on public.automacoes_setor for delete to authenticated using (private.is_bootstrap_platform_admin());

drop policy if exists acesso_total_temporario on public.planos_corte;
drop policy if exists bootstrap_planos_corte_all on public.planos_corte;
create policy bootstrap_planos_corte_all on public.planos_corte for all to authenticated using (private.is_bootstrap_company_member()) with check (private.is_bootstrap_company_member());

drop policy if exists acesso_total_temporario on public.plano_corte_componentes;
drop policy if exists bootstrap_plano_componentes_all on public.plano_corte_componentes;
create policy bootstrap_plano_componentes_all on public.plano_corte_componentes for all to authenticated using (private.is_bootstrap_company_member()) with check (private.is_bootstrap_company_member());

drop policy if exists acesso_total_temporario on public.engenharia_variaveis_preset;
drop policy if exists bootstrap_variaveis_preset_all on public.engenharia_variaveis_preset;
create policy bootstrap_variaveis_preset_all on public.engenharia_variaveis_preset for all to authenticated using (private.is_bootstrap_company_member()) with check (private.is_bootstrap_company_member());
