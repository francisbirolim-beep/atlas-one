alter table public.planos_corte add column if not exists empresa_id uuid references public.empresas(id) default private.current_empresa_id();
alter table public.plano_corte_componentes add column if not exists empresa_id uuid references public.empresas(id) default private.current_empresa_id();
create or replace function private.guard_plano_corte_empresa() returns trigger language plpgsql security definer set search_path='' as $$
declare v_emp uuid; v_ref uuid;
begin
 v_emp:=new.empresa_id;
 if new.ordem_producao_id is not null then select empresa_id into v_ref from public.ordens_producao where id=new.ordem_producao_id; if v_ref is null then raise exception 'Ordem de produção inválida para plano de corte'; end if; if v_emp is null then v_emp:=v_ref; elsif v_emp<>v_ref then raise exception 'Empresa divergente na ordem de produção'; end if; end if;
 if new.venda_obra_id is not null then select empresa_id into v_ref from public.vendas_obras where id=new.venda_obra_id; if v_ref is null then raise exception 'Venda inválida para plano de corte'; end if; if v_emp is null then v_emp:=v_ref; elsif v_emp<>v_ref then raise exception 'Empresa divergente na venda'; end if; end if;
 if new.orcamento_id is not null then select empresa_id into v_ref from public.orcamentos where id=new.orcamento_id; if v_ref is null then raise exception 'Orçamento inválido para plano de corte'; end if; if v_emp is null then v_emp:=v_ref; elsif v_emp<>v_ref then raise exception 'Empresa divergente no orçamento'; end if; end if;
 if new.obra_id is not null then select empresa_id into v_ref from public.obras where id=new.obra_id; if v_ref is null then raise exception 'Obra inválida para plano de corte'; end if; if v_emp is null then v_emp:=v_ref; elsif v_emp<>v_ref then raise exception 'Empresa divergente na obra'; end if; end if;
 if new.cliente_id is not null then select empresa_id into v_ref from public.clientes where id=new.cliente_id; if v_ref is null then raise exception 'Cliente inválido para plano de corte'; end if; if v_emp is null then v_emp:=v_ref; elsif v_emp<>v_ref then raise exception 'Empresa divergente no cliente'; end if; end if;
 if new.produto_id is not null then select empresa_id into v_ref from public.produtos where id=new.produto_id; if v_ref is null then raise exception 'Produto inválido para plano de corte'; end if; if v_emp is null then v_emp:=v_ref; elsif v_emp<>v_ref then raise exception 'Empresa divergente no produto'; end if; end if;
 if v_emp is null then v_emp:=private.current_empresa_id(); end if; if v_emp is null then raise exception 'Plano de corte sem empresa vinculada'; end if; new.empresa_id:=v_emp; return new;
end $$;
create or replace function private.guard_plano_corte_componente_empresa() returns trigger language plpgsql security definer set search_path='' as $$
declare v_plano_emp uuid; v_prod_emp uuid;
begin
 select empresa_id into v_plano_emp from public.planos_corte where id=new.plano_id; if v_plano_emp is null then raise exception 'Plano de corte pai inválido'; end if;
 if new.empresa_id is not null and new.empresa_id<>v_plano_emp then raise exception 'Empresa divergente no componente do plano'; end if;
 if new.produto_id is not null then select empresa_id into v_prod_emp from public.produtos where id=new.produto_id; if v_prod_emp is null or v_prod_emp<>v_plano_emp then raise exception 'Produto de outra empresa no componente do plano'; end if; end if;
 new.empresa_id:=v_plano_emp; return new;
end $$;
revoke all on function private.guard_plano_corte_empresa() from public,anon,authenticated;
revoke all on function private.guard_plano_corte_componente_empresa() from public,anon,authenticated;
drop trigger if exists trg_guard_plano_corte_empresa on public.planos_corte; create trigger trg_guard_plano_corte_empresa before insert or update on public.planos_corte for each row execute function private.guard_plano_corte_empresa();
drop trigger if exists trg_guard_plano_corte_componente_empresa on public.plano_corte_componentes; create trigger trg_guard_plano_corte_componente_empresa before insert or update on public.plano_corte_componentes for each row execute function private.guard_plano_corte_componente_empresa();
alter table public.planos_corte alter column empresa_id set not null;
alter table public.plano_corte_componentes alter column empresa_id set not null;
drop policy if exists legados_globais_select_bootstrap on public.planos_corte; drop policy if exists legados_globais_insert_bootstrap_member on public.planos_corte; drop policy if exists legados_globais_update_bootstrap_member on public.planos_corte; drop policy if exists legados_globais_delete_bootstrap_member on public.planos_corte;
drop policy if exists legados_globais_select_bootstrap on public.plano_corte_componentes; drop policy if exists legados_globais_insert_bootstrap_member on public.plano_corte_componentes; drop policy if exists legados_globais_update_bootstrap_member on public.plano_corte_componentes; drop policy if exists legados_globais_delete_bootstrap_member on public.plano_corte_componentes;
create policy tenant_planos_corte_select on public.planos_corte for select to authenticated using (empresa_id=(select private.current_empresa_id()));
create policy tenant_planos_corte_insert on public.planos_corte for insert to authenticated with check (empresa_id=(select private.current_empresa_id()) and (private.usuario_pode_editar_setor(auth.uid(),empresa_id,'engenharia-projeto') or private.usuario_pode_editar_setor(auth.uid(),empresa_id,'producao')));
create policy tenant_planos_corte_update on public.planos_corte for update to authenticated using (empresa_id=(select private.current_empresa_id()) and (private.usuario_pode_editar_setor(auth.uid(),empresa_id,'engenharia-projeto') or private.usuario_pode_editar_setor(auth.uid(),empresa_id,'producao'))) with check (empresa_id=(select private.current_empresa_id()) and (private.usuario_pode_editar_setor(auth.uid(),empresa_id,'engenharia-projeto') or private.usuario_pode_editar_setor(auth.uid(),empresa_id,'producao')));
create policy tenant_planos_corte_delete on public.planos_corte for delete to authenticated using (empresa_id=(select private.current_empresa_id()) and (private.usuario_pode_editar_setor(auth.uid(),empresa_id,'engenharia-projeto') or private.usuario_pode_editar_setor(auth.uid(),empresa_id,'producao')));
create policy tenant_plano_componentes_select on public.plano_corte_componentes for select to authenticated using (empresa_id=(select private.current_empresa_id()));
create policy tenant_plano_componentes_insert on public.plano_corte_componentes for insert to authenticated with check (empresa_id=(select private.current_empresa_id()) and (private.usuario_pode_editar_setor(auth.uid(),empresa_id,'engenharia-projeto') or private.usuario_pode_editar_setor(auth.uid(),empresa_id,'producao')));
create policy tenant_plano_componentes_update on public.plano_corte_componentes for update to authenticated using (empresa_id=(select private.current_empresa_id()) and (private.usuario_pode_editar_setor(auth.uid(),empresa_id,'engenharia-projeto') or private.usuario_pode_editar_setor(auth.uid(),empresa_id,'producao'))) with check (empresa_id=(select private.current_empresa_id()) and (private.usuario_pode_editar_setor(auth.uid(),empresa_id,'engenharia-projeto') or private.usuario_pode_editar_setor(auth.uid(),empresa_id,'producao')));
create policy tenant_plano_componentes_delete on public.plano_corte_componentes for delete to authenticated using (empresa_id=(select private.current_empresa_id()) and (private.usuario_pode_editar_setor(auth.uid(),empresa_id,'engenharia-projeto') or private.usuario_pode_editar_setor(auth.uid(),empresa_id,'producao')));
create index if not exists planos_corte_empresa_idx on public.planos_corte(empresa_id,created_at desc);
create index if not exists plano_corte_componentes_empresa_idx on public.plano_corte_componentes(empresa_id,plano_id);
