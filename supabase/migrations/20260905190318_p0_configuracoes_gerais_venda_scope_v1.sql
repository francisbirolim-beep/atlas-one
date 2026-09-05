create or replace function private.configuracao_geral_usuario_pode_escrever(p_usuario_id uuid,p_empresa_id uuid,p_chave text)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_orcamento_id uuid;
begin
  if p_usuario_id is null or p_empresa_id is null or p_chave is null then return false; end if;
  if private.usuario_master_mesma_empresa(p_usuario_id,p_empresa_id) then return true; end if;
  if p_chave=('home_usuario:'||p_usuario_id::text) then return true; end if;
  if p_chave ~* '^dados_venda_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_orcamento_id:=replace(p_chave,'dados_venda_','')::uuid;
    return private.usuario_pode_editar_setor(p_usuario_id,p_empresa_id,'orcamentos')
      and exists(select 1 from public.orcamentos o where o.id=v_orcamento_id and o.empresa_id=p_empresa_id);
  end if;
  return false;
end;
$$;
revoke all on function private.configuracao_geral_usuario_pode_escrever(uuid,uuid,text) from public,anon;
grant execute on function private.configuracao_geral_usuario_pode_escrever(uuid,uuid,text) to authenticated,service_role;

drop policy if exists tenant_configuracoes_gerais_insert on public.configuracoes_gerais;
drop policy if exists tenant_configuracoes_gerais_update on public.configuracoes_gerais;
drop policy if exists tenant_configuracoes_gerais_delete on public.configuracoes_gerais;

create policy tenant_configuracoes_gerais_insert on public.configuracoes_gerais for insert to authenticated
with check (empresa_id=(select private.current_empresa_id()) and private.configuracao_geral_usuario_pode_escrever((select auth.uid()),empresa_id,chave));
create policy tenant_configuracoes_gerais_update on public.configuracoes_gerais for update to authenticated
using (empresa_id=(select private.current_empresa_id()) and private.configuracao_geral_usuario_pode_escrever((select auth.uid()),empresa_id,chave))
with check (empresa_id=(select private.current_empresa_id()) and private.configuracao_geral_usuario_pode_escrever((select auth.uid()),empresa_id,chave));
create policy tenant_configuracoes_gerais_delete on public.configuracoes_gerais for delete to authenticated
using (empresa_id=(select private.current_empresa_id()) and private.configuracao_geral_usuario_pode_escrever((select auth.uid()),empresa_id,chave));
