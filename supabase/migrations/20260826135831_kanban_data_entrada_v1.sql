alter table public.orcamentos
  add column if not exists kanban_entrada_em timestamptz;

update public.orcamentos
set kanban_entrada_em = coalesce(coluna_atualizada_em, created_at, now())
where kanban_entrada_em is null
  and coalesce(modo_entrada, 'formulario') <> 'balcao';

create or replace function public.definir_kanban_entrada_em()
returns trigger
language plpgsql
as $$
begin
  if new.kanban_entrada_em is null
     and coalesce(new.modo_entrada, 'formulario') <> 'balcao' then
    new.kanban_entrada_em := coalesce(new.created_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_definir_kanban_entrada_em on public.orcamentos;
create trigger trg_definir_kanban_entrada_em
before insert or update of modo_entrada, coluna_id
on public.orcamentos
for each row
execute function public.definir_kanban_entrada_em();
