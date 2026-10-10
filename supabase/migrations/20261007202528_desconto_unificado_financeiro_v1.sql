
alter table public.financeiro_recebimentos
  add column if not exists valor_desconto numeric not null default 0;

alter table public.financeiro_recebimentos
  drop constraint if exists financeiro_recebimentos_valor_desconto_check;

alter table public.financeiro_recebimentos
  add constraint financeiro_recebimentos_valor_desconto_check
  check (valor_desconto >= 0);

update public.financeiro_recebimentos r
set valor_desconto = x.desconto
from (
  select recebimento_id, coalesce(sum(valor) filter (where tipo='desconto'),0) as desconto
  from public.financeiro_recebimento_alocacoes
  group by recebimento_id
) x
where x.recebimento_id=r.id
  and r.valor_desconto is distinct from x.desconto;

update public.financeiro_contas_receber c
set valor_desconto = x.desconto
from (
  select conta_receber_id, coalesce(sum(valor) filter (where tipo='desconto'),0) as desconto
  from public.financeiro_recebimento_alocacoes
  where conta_receber_id is not null
  group by conta_receber_id
) x
where x.conta_receber_id=c.id
  and c.valor_desconto is distinct from x.desconto;

create or replace function private.sync_financeiro_desconto_alocacao()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_recebimento_id uuid;
  v_conta_id uuid;
begin
  v_recebimento_id := coalesce(new.recebimento_id, old.recebimento_id);
  v_conta_id := coalesce(new.conta_receber_id, old.conta_receber_id);

  if v_recebimento_id is not null then
    update public.financeiro_recebimentos r
       set valor_desconto = coalesce((
         select sum(a.valor)
         from public.financeiro_recebimento_alocacoes a
         where a.recebimento_id=v_recebimento_id
           and a.tipo='desconto'
       ),0)
     where r.id=v_recebimento_id;
  end if;

  if v_conta_id is not null then
    update public.financeiro_contas_receber c
       set valor_desconto = coalesce((
         select sum(a.valor)
         from public.financeiro_recebimento_alocacoes a
         where a.conta_receber_id=v_conta_id
           and a.tipo='desconto'
       ),0),
           updated_at = now()
     where c.id=v_conta_id;
  end if;

  if tg_op='UPDATE' then
    if old.recebimento_id is distinct from new.recebimento_id and old.recebimento_id is not null then
      update public.financeiro_recebimentos r
         set valor_desconto = coalesce((
           select sum(a.valor)
           from public.financeiro_recebimento_alocacoes a
           where a.recebimento_id=old.recebimento_id
             and a.tipo='desconto'
         ),0)
       where r.id=old.recebimento_id;
    end if;

    if old.conta_receber_id is distinct from new.conta_receber_id and old.conta_receber_id is not null then
      update public.financeiro_contas_receber c
         set valor_desconto = coalesce((
           select sum(a.valor)
           from public.financeiro_recebimento_alocacoes a
           where a.conta_receber_id=old.conta_receber_id
             and a.tipo='desconto'
         ),0),
             updated_at = now()
       where c.id=old.conta_receber_id;
    end if;
  end if;

  return coalesce(new,old);
end;
$$;

drop trigger if exists trg_sync_financeiro_desconto_alocacao
on public.financeiro_recebimento_alocacoes;

create trigger trg_sync_financeiro_desconto_alocacao
after insert or update or delete
on public.financeiro_recebimento_alocacoes
for each row
execute function private.sync_financeiro_desconto_alocacao();

revoke all on function private.sync_financeiro_desconto_alocacao() from public, anon, authenticated;
