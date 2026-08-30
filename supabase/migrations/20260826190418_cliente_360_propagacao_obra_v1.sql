create or replace function public.cliente360_definir_obra_medicao()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.obra_id is null and new.orcamento_id is not null then
    select o.obra_id into new.obra_id
    from public.orcamentos o
    where o.id = new.orcamento_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cliente360_obra_medicao on public.medicoes_finais;
create trigger trg_cliente360_obra_medicao
before insert or update of orcamento_id on public.medicoes_finais
for each row execute function public.cliente360_definir_obra_medicao();

create or replace function public.cliente360_definir_obra_conta_receber()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.obra_id is null and new.venda_balcao_id is not null then
    select v.obra_id into new.obra_id
    from public.balcao_vendas v
    where v.id = new.venda_balcao_id;
  end if;

  if new.obra_id is null and new.orcamento_id is not null then
    select o.obra_id into new.obra_id
    from public.orcamentos o
    where o.id = new.orcamento_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cliente360_obra_conta_receber on public.financeiro_contas_receber;
create trigger trg_cliente360_obra_conta_receber
before insert or update of venda_balcao_id, orcamento_id on public.financeiro_contas_receber
for each row execute function public.cliente360_definir_obra_conta_receber();