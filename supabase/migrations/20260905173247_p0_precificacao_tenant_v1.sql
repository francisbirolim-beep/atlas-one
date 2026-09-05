create or replace function private.usuario_master_mesma_empresa(p_usuario_id uuid, p_empresa_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.usuarios u where u.id=p_usuario_id and u.empresa_id=p_empresa_id and u.role='master');
$$;
revoke all on function private.usuario_master_mesma_empresa(uuid,uuid) from public,anon,authenticated;
grant execute on function private.usuario_master_mesma_empresa(uuid,uuid) to service_role;

alter table public.configuracoes_precificacao add column if not exists empresa_id uuid references public.empresas(id);
update public.configuracoes_precificacao c set empresa_id=e.id from public.empresas e where c.empresa_id is null and e.slug='esquadrifacio';
alter table public.configuracoes_precificacao alter column empresa_id set default private.current_empresa_id();
alter table public.configuracoes_precificacao alter column empresa_id set not null;
alter table public.configuracoes_precificacao drop constraint if exists configuracoes_precificacao_chave_key;
alter table public.configuracoes_precificacao drop constraint if exists configuracoes_precificacao_empresa_chave_key;
alter table public.configuracoes_precificacao add constraint configuracoes_precificacao_empresa_chave_key unique(empresa_id,chave);
drop policy if exists legados_globais_select_bootstrap on public.configuracoes_precificacao;
drop policy if exists legados_globais_insert_bootstrap_master on public.configuracoes_precificacao;
drop policy if exists legados_globais_update_bootstrap_master on public.configuracoes_precificacao;
drop policy if exists legados_globais_delete_bootstrap_master on public.configuracoes_precificacao;
create policy tenant_precificacao_select on public.configuracoes_precificacao for select to authenticated using (empresa_id=(select private.current_empresa_id()));
create policy tenant_precificacao_insert on public.configuracoes_precificacao for insert to authenticated with check (empresa_id=(select private.current_empresa_id()) and private.usuario_master_mesma_empresa(auth.uid(),empresa_id));
create policy tenant_precificacao_update on public.configuracoes_precificacao for update to authenticated using (empresa_id=(select private.current_empresa_id()) and private.usuario_master_mesma_empresa(auth.uid(),empresa_id)) with check (empresa_id=(select private.current_empresa_id()) and private.usuario_master_mesma_empresa(auth.uid(),empresa_id));
create policy tenant_precificacao_delete on public.configuracoes_precificacao for delete to authenticated using (empresa_id=(select private.current_empresa_id()) and private.usuario_master_mesma_empresa(auth.uid(),empresa_id));
create index if not exists configuracoes_precificacao_empresa_idx on public.configuracoes_precificacao(empresa_id,chave);
