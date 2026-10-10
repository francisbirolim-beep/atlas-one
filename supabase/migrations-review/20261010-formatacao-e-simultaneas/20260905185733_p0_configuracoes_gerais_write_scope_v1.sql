drop policy if exists tenant_configuracoes_gerais_insert on public.configuracoes_gerais;
drop policy if exists tenant_configuracoes_gerais_update on public.configuracoes_gerais;
drop policy if exists tenant_configuracoes_gerais_delete on public.configuracoes_gerais;

create policy tenant_configuracoes_gerais_insert
on public.configuracoes_gerais for insert to authenticated
with check (
  empresa_id=(select private.current_empresa_id())
  and (
    private.usuario_master_mesma_empresa((select auth.uid()), empresa_id)
    or chave=('home_usuario:'||(select auth.uid())::text)
  )
);

create policy tenant_configuracoes_gerais_update
on public.configuracoes_gerais for update to authenticated
using (
  empresa_id=(select private.current_empresa_id())
  and (
    private.usuario_master_mesma_empresa((select auth.uid()), empresa_id)
    or chave=('home_usuario:'||(select auth.uid())::text)
  )
)
with check (
  empresa_id=(select private.current_empresa_id())
  and (
    private.usuario_master_mesma_empresa((select auth.uid()), empresa_id)
    or chave=('home_usuario:'||(select auth.uid())::text)
  )
);

create policy tenant_configuracoes_gerais_delete
on public.configuracoes_gerais for delete to authenticated
using (
  empresa_id=(select private.current_empresa_id())
  and (
    private.usuario_master_mesma_empresa((select auth.uid()), empresa_id)
    or chave=('home_usuario:'||(select auth.uid())::text)
  )
);
