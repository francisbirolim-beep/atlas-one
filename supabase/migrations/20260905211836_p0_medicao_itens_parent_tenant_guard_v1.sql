create or replace function private.medicao_item_empresa_guard()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_empresa uuid;
begin
  select m.empresa_id into v_empresa
  from public.medicoes_finais m
  where m.id=new.medicao_id;

  if v_empresa is null then
    raise exception 'Medição pai inválida ou sem empresa.';
  end if;

  if new.empresa_id is null then
    new.empresa_id := v_empresa;
  elsif new.empresa_id is distinct from v_empresa then
    raise exception 'Item da medição pertence a empresa diferente da medição pai.';
  end if;

  return new;
end;
$$;

revoke all on function private.medicao_item_empresa_guard() from public, anon, authenticated;
grant execute on function private.medicao_item_empresa_guard() to service_role;

drop trigger if exists trg_medicao_item_empresa_guard on public.medicao_itens;
create trigger trg_medicao_item_empresa_guard
before insert or update of medicao_id,empresa_id on public.medicao_itens
for each row execute function private.medicao_item_empresa_guard();
