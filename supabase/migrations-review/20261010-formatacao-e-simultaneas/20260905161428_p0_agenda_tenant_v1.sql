alter table public.eventos alter column empresa_id set not null;
alter table public.evento_convidados alter column empresa_id set not null;

create or replace function private.is_dono_evento(p_evento_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.eventos e where e.id=p_evento_id and e.usuario_id=auth.uid() and e.empresa_id=private.current_empresa_id());
$$;
create or replace function private.is_convidado_evento(p_evento_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.evento_convidados ec where ec.evento_id=p_evento_id and ec.usuario_id=auth.uid() and ec.empresa_id=private.current_empresa_id());
$$;
revoke all on function private.is_dono_evento(uuid) from public,anon;
revoke all on function private.is_convidado_evento(uuid) from public,anon;
grant execute on function private.is_dono_evento(uuid) to authenticated,service_role;
grant execute on function private.is_convidado_evento(uuid) to authenticated,service_role;

drop policy if exists eventos_select on public.eventos;
drop policy if exists eventos_insert on public.eventos;
drop policy if exists eventos_update on public.eventos;
drop policy if exists eventos_delete on public.eventos;
create policy eventos_select on public.eventos for select to authenticated using (empresa_id=private.current_empresa_id() and (usuario_id=auth.uid() or private.is_convidado_evento(id)));
create policy eventos_insert on public.eventos for insert to authenticated with check (empresa_id=private.current_empresa_id() and usuario_id=auth.uid());
create policy eventos_update on public.eventos for update to authenticated using (empresa_id=private.current_empresa_id() and usuario_id=auth.uid()) with check (empresa_id=private.current_empresa_id() and usuario_id=auth.uid());
create policy eventos_delete on public.eventos for delete to authenticated using (empresa_id=private.current_empresa_id() and usuario_id=auth.uid());

drop policy if exists evento_convidados_select on public.evento_convidados;
drop policy if exists evento_convidados_insert on public.evento_convidados;
drop policy if exists evento_convidados_update on public.evento_convidados;
drop policy if exists evento_convidados_delete on public.evento_convidados;
create policy evento_convidados_select on public.evento_convidados for select to authenticated using (empresa_id=private.current_empresa_id() and (usuario_id=auth.uid() or private.is_dono_evento(evento_id)));
create policy evento_convidados_insert on public.evento_convidados for insert to authenticated with check (empresa_id=private.current_empresa_id() and private.is_dono_evento(evento_id) and exists(select 1 from public.usuarios u where u.id=usuario_id and u.empresa_id=private.current_empresa_id()));
create policy evento_convidados_update on public.evento_convidados for update to authenticated using (empresa_id=private.current_empresa_id() and (usuario_id=auth.uid() or private.is_dono_evento(evento_id))) with check (empresa_id=private.current_empresa_id() and (usuario_id=auth.uid() or private.is_dono_evento(evento_id)) and exists(select 1 from public.usuarios u where u.id=usuario_id and u.empresa_id=private.current_empresa_id()));
create policy evento_convidados_delete on public.evento_convidados for delete to authenticated using (empresa_id=private.current_empresa_id() and (usuario_id=auth.uid() or private.is_dono_evento(evento_id)));

drop function if exists public.is_dono_evento(uuid);
drop function if exists public.is_convidado_evento(uuid);
