alter table public.automacoes_setor add column if not exists empresa_id uuid references public.empresas(id);
update public.automacoes_setor a set empresa_id=kc.empresa_id from public.kanban_colunas kc where kc.id=a.coluna_id and a.empresa_id is null;
alter table public.automacoes_setor alter column empresa_id set default private.current_empresa_id();
alter table public.automacoes_setor alter column empresa_id set not null;
create or replace function private.guard_automacao_setor_empresa() returns trigger language plpgsql security definer set search_path='' as $$
declare v_emp uuid;
begin
 select empresa_id into v_emp from public.kanban_colunas where id=new.coluna_id;
 if v_emp is null then raise exception 'Coluna inválida para automação de setor'; end if;
 if new.empresa_id is not null and new.empresa_id<>v_emp then raise exception 'Empresa divergente na automação de setor'; end if;
 new.empresa_id:=v_emp; return new;
end $$;
revoke all on function private.guard_automacao_setor_empresa() from public,anon,authenticated;
drop trigger if exists trg_guard_automacao_setor_empresa on public.automacoes_setor;
create trigger trg_guard_automacao_setor_empresa before insert or update on public.automacoes_setor for each row execute function private.guard_automacao_setor_empresa();
drop policy if exists legados_globais_select_bootstrap on public.automacoes_setor;
drop policy if exists legados_globais_insert_bootstrap_master on public.automacoes_setor;
drop policy if exists legados_globais_update_bootstrap_master on public.automacoes_setor;
drop policy if exists legados_globais_delete_bootstrap_master on public.automacoes_setor;
create policy tenant_automacoes_setor_select on public.automacoes_setor for select to authenticated using (empresa_id=(select private.current_empresa_id()));
create policy tenant_automacoes_setor_insert on public.automacoes_setor for insert to authenticated with check (empresa_id=(select private.current_empresa_id()) and private.usuario_master_mesma_empresa(auth.uid(),empresa_id));
create policy tenant_automacoes_setor_update on public.automacoes_setor for update to authenticated using (empresa_id=(select private.current_empresa_id()) and private.usuario_master_mesma_empresa(auth.uid(),empresa_id)) with check (empresa_id=(select private.current_empresa_id()) and private.usuario_master_mesma_empresa(auth.uid(),empresa_id));
create policy tenant_automacoes_setor_delete on public.automacoes_setor for delete to authenticated using (empresa_id=(select private.current_empresa_id()) and private.usuario_master_mesma_empresa(auth.uid(),empresa_id));
create index if not exists automacoes_setor_empresa_idx on public.automacoes_setor(empresa_id,coluna_id);
