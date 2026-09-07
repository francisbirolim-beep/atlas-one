begin;

alter table public.assistencia_acessos_externos add column if not exists empresa_id uuid references public.empresas(id);

update public.assistencia_acessos_externos a
set empresa_id = s.empresa_id
from public.assistencias s
where s.id = a.assistencia_id
  and a.empresa_id is null;

alter table public.assistencia_acessos_externos alter column empresa_id set not null;
create index if not exists idx_assistencia_acessos_externos_empresa_id on public.assistencia_acessos_externos(empresa_id);

create or replace function private.guard_assistencia_acesso_externo_empresa()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_empresa_assistencia uuid;
begin
  select a.empresa_id into v_empresa_assistencia
  from public.assistencias a
  where a.id = new.assistencia_id;

  if v_empresa_assistencia is null then
    raise exception 'Assistência sem empresa válida';
  end if;

  if new.empresa_id is distinct from v_empresa_assistencia then
    raise exception 'Acesso externo pertence a outra empresa';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_assistencia_acesso_externo_empresa() from public, anon, authenticated;
grant execute on function private.guard_assistencia_acesso_externo_empresa() to service_role;

drop trigger if exists trg_assistencia_acesso_externo_empresa_guard on public.assistencia_acessos_externos;
create trigger trg_assistencia_acesso_externo_empresa_guard
before insert or update on public.assistencia_acessos_externos
for each row execute function private.guard_assistencia_acesso_externo_empresa();

commit;