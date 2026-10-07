begin;

-- Mantém o vínculo entre cada peça da Medição Final e o item técnico vendido.
-- Isso permite recalcular a produção com as medidas reais sem perder linha,
-- tipologia, variáveis, receita e item_ref do orçamento original.
alter table public.medicao_itens
  add column if not exists origem_item_indice integer,
  add column if not exists origem_item_ref text;

create index if not exists medicao_itens_origem_item_ref_idx
  on public.medicao_itens(empresa_id, medicao_id, origem_item_ref);

-- Recupera o vínculo das medições já existentes. Quando houve separação de
-- quantidade, as ordens passam a reservar blocos de 100 (0,100,200...).
with base as (
  select
    mi.id,
    mi.medicao_id,
    mi.ordem,
    o.itens,
    jsonb_array_length(coalesce(o.itens, '[]'::jsonb)) as total_origem,
    exists (
      select 1
      from public.medicao_itens x
      where x.medicao_id = mi.medicao_id
        and x.empresa_id = mi.empresa_id
        and coalesce(x.ordem, 0) >= 100
    ) as separada
  from public.medicao_itens mi
  join public.medicoes_finais mf
    on mf.id = mi.medicao_id
   and mf.empresa_id = mi.empresa_id
  join public.orcamentos o
    on o.id = mf.orcamento_id
   and o.empresa_id = mi.empresa_id
  where mf.orcamento_id is not null
),
resolvida as (
  select
    id,
    itens,
    case
      when total_origem = 1 then 0
      when separada then floor(coalesce(ordem, 0) / 100.0)::integer
      else coalesce(ordem, 0)
    end as indice
  from base
)
update public.medicao_itens mi
set
  origem_item_indice = r.indice,
  origem_item_ref = coalesce(
    nullif(r.itens -> r.indice ->> 'id', ''),
    'item-' || (r.indice + 1)::text
  )
from resolvida r
where mi.id = r.id
  and r.indice >= 0
  and r.indice < jsonb_array_length(coalesce(r.itens, '[]'::jsonb))
  and (mi.origem_item_indice is null or mi.origem_item_ref is null);

-- Novas linhas criadas por qualquer fluxo (UI, workflow ou importação) recebem
-- o vínculo automaticamente. Clones de quantidade copiam explicitamente o
-- vínculo original no código da Medição Final.
create or replace function private.medicao_item_vincular_origem_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid;
  v_orcamento_id uuid;
  v_itens jsonb;
  v_total integer;
  v_indice integer;
begin
  if new.origem_item_indice is not null and nullif(new.origem_item_ref, '') is not null then
    return new;
  end if;

  select mf.empresa_id, mf.orcamento_id
    into v_empresa_id, v_orcamento_id
    from public.medicoes_finais mf
   where mf.id = new.medicao_id;

  if v_empresa_id is null then
    raise exception 'Medição pai inválida ou sem empresa ao vincular item de origem.';
  end if;

  if new.empresa_id is null then
    new.empresa_id := v_empresa_id;
  elsif new.empresa_id is distinct from v_empresa_id then
    raise exception 'Item da medição pertence a empresa diferente da medição pai.';
  end if;

  if v_orcamento_id is null then
    return new;
  end if;

  select coalesce(o.itens, '[]'::jsonb)
    into v_itens
    from public.orcamentos o
   where o.id = v_orcamento_id
     and o.empresa_id = v_empresa_id;

  v_total := jsonb_array_length(coalesce(v_itens, '[]'::jsonb));
  if v_total <= 0 then
    return new;
  end if;

  v_indice := case
    when v_total = 1 then 0
    else greatest(coalesce(new.ordem, 0), 0)
  end;

  if v_indice >= v_total then
    return new;
  end if;

  new.origem_item_indice := coalesce(new.origem_item_indice, v_indice);
  new.origem_item_ref := coalesce(
    nullif(new.origem_item_ref, ''),
    nullif(v_itens -> v_indice ->> 'id', ''),
    'item-' || (v_indice + 1)::text
  );
  return new;
end;
$$;

revoke all on function private.medicao_item_vincular_origem_v1() from public, anon, authenticated;
grant execute on function private.medicao_item_vincular_origem_v1() to service_role;

drop trigger if exists trg_medicao_item_vincular_origem_v1 on public.medicao_itens;
create trigger trg_medicao_item_vincular_origem_v1
before insert on public.medicao_itens
for each row execute function private.medicao_item_vincular_origem_v1();

commit;
