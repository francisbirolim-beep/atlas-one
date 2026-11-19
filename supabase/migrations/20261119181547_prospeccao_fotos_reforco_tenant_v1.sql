drop policy if exists prospeccao_fotos_select on public.prospeccao_fotos;
create policy prospeccao_fotos_select on public.prospeccao_fotos
for select to authenticated using (
  empresa_id = (select private.current_empresa_id())
  and exists (
    select 1 from public.prospeccoes p
    where p.id = prospeccao_id
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas()))
  )
);

drop policy if exists prospeccao_fotos_insert on public.prospeccao_fotos;
create policy prospeccao_fotos_insert on public.prospeccao_fotos
for insert to authenticated with check (
  empresa_id = (select private.current_empresa_id())
  and enviado_por = (select auth.uid())
  and exists (
    select 1 from public.prospeccoes p
    where p.id = prospeccao_id
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas()))
  )
);

drop policy if exists prospeccao_fotos_delete on public.prospeccao_fotos;
create policy prospeccao_fotos_delete on public.prospeccao_fotos
for delete to authenticated using (
  empresa_id = (select private.current_empresa_id())
  and (enviado_por = (select auth.uid()) or (select private.is_master_atlas()))
  and exists (
    select 1 from public.prospeccoes p
    where p.id = prospeccao_id
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas()))
  )
);
