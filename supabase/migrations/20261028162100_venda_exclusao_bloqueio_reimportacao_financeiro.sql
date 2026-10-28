-- Evita recriação silenciosa de contas para venda excluída em nova sincronização.
begin;
create or replace function public.bloquear_financeiro_de_venda_excluida_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if new.venda_obra_id is not null and exists (
   select 1 from public.vendas_obras v
   where v.id=new.venda_obra_id and v.excluida_em is not null
 ) then
   raise exception 'Venda excluída: não é permitido criar ou vincular nova conta a receber';
 end if;
 return new;
end;$$;

drop trigger if exists trg_bloquear_financeiro_venda_excluida_v1
 on public.financeiro_contas_receber;
create trigger trg_bloquear_financeiro_venda_excluida_v1
 before insert or update of venda_obra_id on public.financeiro_contas_receber
 for each row execute function public.bloquear_financeiro_de_venda_excluida_v1();
commit;
