create or replace function public.fn_orcamento_obra_coluna_orcamento_feito_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coluna_id uuid;
begin
  if coalesce(new.modo_entrada, '') = 'formulario'
     and coalesce(new.status, '') = 'rascunho' then
    select kc.id
      into v_coluna_id
      from public.kanban_colunas kc
     where lower(trim(kc.nome)) in ('orçamento feito', 'orcamento feito')
     order by kc.ordem
     limit 1;

    if v_coluna_id is not null then
      new.coluna_id := v_coluna_id;
      new.coluna_atualizada_em := now();
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.fn_orcamento_obra_coluna_orcamento_feito_v1() from public;

drop trigger if exists trg_orcamento_obra_coluna_orcamento_feito_v1 on public.orcamentos;
create trigger trg_orcamento_obra_coluna_orcamento_feito_v1
before insert on public.orcamentos
for each row
execute function public.fn_orcamento_obra_coluna_orcamento_feito_v1();
