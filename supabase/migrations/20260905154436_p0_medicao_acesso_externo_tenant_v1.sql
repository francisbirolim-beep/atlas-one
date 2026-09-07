begin;

update public.medicao_acessos_externos a
set empresa_id = m.empresa_id
from public.medicoes_finais m
where m.id = a.medicao_id
  and a.empresa_id is null;

alter table public.medicao_acessos_externos alter column empresa_id set not null;
create index if not exists idx_medicao_acessos_externos_empresa_id on public.medicao_acessos_externos(empresa_id);

create or replace function private.guard_medicao_acesso_externo_empresa()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_empresa_medicao uuid;
begin
  select m.empresa_id into v_empresa_medicao
  from public.medicoes_finais m
  where m.id = new.medicao_id;

  if v_empresa_medicao is null then
    raise exception 'Medição sem empresa válida';
  end if;

  if new.empresa_id is distinct from v_empresa_medicao then
    raise exception 'Acesso externo pertence a outra empresa';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_medicao_acesso_externo_empresa() from public, anon, authenticated;
grant execute on function private.guard_medicao_acesso_externo_empresa() to service_role;

drop trigger if exists trg_medicao_acesso_externo_empresa_guard on public.medicao_acessos_externos;
create trigger trg_medicao_acesso_externo_empresa_guard
before insert or update on public.medicao_acessos_externos
for each row execute function private.guard_medicao_acesso_externo_empresa();

commit;