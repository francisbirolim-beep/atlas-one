alter table public.engenharia_variaveis_preset add column if not exists empresa_id uuid references public.empresas(id);

update public.engenharia_variaveis_preset p
set empresa_id = u.empresa_id
from public.usuarios u
where u.id = p.criado_por_id
  and p.empresa_id is null;

alter table public.engenharia_variaveis_preset alter column empresa_id set default private.current_empresa_id();
alter table public.engenharia_variaveis_preset alter column empresa_id set not null;
create index if not exists engenharia_variaveis_preset_empresa_idx on public.engenharia_variaveis_preset(empresa_id,tipologia_id,produto_id);

create or replace function private.engenharia_preset_empresa_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_prod_empresa uuid; v_criador_empresa uuid;
begin
  if new.produto_id is not null then
    select empresa_id into v_prod_empresa from public.produtos where id=new.produto_id;
    if v_prod_empresa is null or v_prod_empresa <> new.empresa_id then raise exception 'Produto do preset pertence a outra empresa'; end if;
  end if;
  if new.criado_por_id is not null then
    select empresa_id into v_criador_empresa from public.usuarios where id=new.criado_por_id;
    if v_criador_empresa is null or v_criador_empresa <> new.empresa_id then raise exception 'Criador do preset pertence a outra empresa'; end if;
  end if;
  return new;
end $$;
revoke all on function private.engenharia_preset_empresa_guard() from public,anon,authenticated;
grant execute on function private.engenharia_preset_empresa_guard() to service_role;

drop trigger if exists engenharia_preset_empresa_guard on public.engenharia_variaveis_preset;
create trigger engenharia_preset_empresa_guard before insert or update on public.engenharia_variaveis_preset for each row execute function private.engenharia_preset_empresa_guard();

alter table public.engenharia_variaveis_preset enable row level security;
drop policy if exists engenharia_preset_bootstrap_select on public.engenharia_variaveis_preset;
drop policy if exists engenharia_preset_bootstrap_insert on public.engenharia_variaveis_preset;
drop policy if exists engenharia_preset_bootstrap_update on public.engenharia_variaveis_preset;
drop policy if exists engenharia_preset_bootstrap_delete on public.engenharia_variaveis_preset;
drop policy if exists tenant_engenharia_preset_select on public.engenharia_variaveis_preset;
drop policy if exists tenant_engenharia_preset_insert on public.engenharia_variaveis_preset;
drop policy if exists tenant_engenharia_preset_update on public.engenharia_variaveis_preset;
drop policy if exists tenant_engenharia_preset_delete on public.engenharia_variaveis_preset;

create policy tenant_engenharia_preset_select on public.engenharia_variaveis_preset for select to authenticated using (empresa_id=(select private.current_empresa_id()));
create policy tenant_engenharia_preset_insert on public.engenharia_variaveis_preset for insert to authenticated with check (empresa_id=(select private.current_empresa_id()) and private.usuario_pode_editar_setor((select auth.uid()),empresa_id,'engenharia-projeto'));
create policy tenant_engenharia_preset_update on public.engenharia_variaveis_preset for update to authenticated using (empresa_id=(select private.current_empresa_id()) and private.usuario_pode_editar_setor((select auth.uid()),empresa_id,'engenharia-projeto')) with check (empresa_id=(select private.current_empresa_id()) and private.usuario_pode_editar_setor((select auth.uid()),empresa_id,'engenharia-projeto'));
create policy tenant_engenharia_preset_delete on public.engenharia_variaveis_preset for delete to authenticated using (empresa_id=(select private.current_empresa_id()) and private.usuario_pode_editar_setor((select auth.uid()),empresa_id,'engenharia-projeto'));
