-- Atlas One — vínculo seguro de suprimentos históricos W.Vetro ao catálogo Atlas.
-- Histórico somente leitura: não altera estoque, custo oficial, compras ou financeiro.

begin;

alter table public.wvetro_historico_suprimentos
  add column if not exists produto_atlas_id uuid null
    references public.produtos(id) on delete set null,
  add column if not exists produto_vinculo_status text null,
  add column if not exists produto_vinculo_metodo text null,
  add column if not exists produto_vinculado_em timestamptz null;

do $$ begin
  alter table public.wvetro_historico_suprimentos
    add constraint wvetro_historico_suprimentos_produto_vinculo_status_check
    check (
      produto_vinculo_status is null
      or produto_vinculo_status in ('seguro','pendente','ambiguo')
    );
exception when duplicate_object then null; end $$;

create index if not exists wvetro_historico_suprimentos_produto_atlas_idx
  on public.wvetro_historico_suprimentos (empresa_id, produto_atlas_id)
  where produto_atlas_id is not null;

with historicos as (
  select
    h.id,
    h.empresa_id,
    h.produto_id_wvetro,
    h.produto_codigo
  from public.wvetro_historico_suprimentos h
  where h.tipo_registro in ('item_nota_entrada','movimento_estoque')
),
candidatos as (
  select distinct
    h.id as historico_id,
    p.id as produto_atlas_id
  from historicos h
  join public.produtos p
    on p.empresa_id = h.empresa_id
   and (
      (nullif(h.produto_id_wvetro,'') is not null
       and nullif(p.id_externo_wvetro,'') = h.produto_id_wvetro)
      or
      (nullif(h.produto_codigo,'') is not null
       and nullif(p.codigo_origem,'') = h.produto_codigo)
      or
      (nullif(h.produto_codigo,'') is not null
       and nullif(p.codigo,'') = h.produto_codigo)
   )
  union
  select distinct
    h.id,
    p.id
  from historicos h
  join public.wvetro_produtos_snapshot s
    on s.produto_atlas_id is not null
   and (
      (nullif(h.produto_id_wvetro,'') is not null
       and nullif(s.produto_wvetro_id,'') = h.produto_id_wvetro)
      or
      (nullif(h.produto_codigo,'') is not null
       and nullif(s.codigo,'') = h.produto_codigo)
      or
      (nullif(h.produto_codigo,'') is not null
       and nullif(s.seu_codigo,'') = h.produto_codigo)
   )
  join public.produtos p
    on p.id = s.produto_atlas_id
   and p.empresa_id = h.empresa_id
),
por_historico as (
  select
    h.id,
    count(distinct c.produto_atlas_id)::int as candidatos,
    min(c.produto_atlas_id::text)::uuid as produto_atlas_id
  from historicos h
  left join candidatos c on c.historico_id = h.id
  group by h.id
)
update public.wvetro_historico_suprimentos h
set
  produto_atlas_id = case when x.candidatos = 1 then x.produto_atlas_id else null end,
  produto_vinculo_status = case
    when x.candidatos = 1 then 'seguro'
    when x.candidatos = 0 then 'pendente'
    else 'ambiguo'
  end,
  produto_vinculo_metodo = case
    when x.candidatos = 1 then 'id_codigo_wvetro_catalogo'
    else null
  end,
  produto_vinculado_em = case
    when x.candidatos = 1 then now()
    else null
  end,
  updated_at = now()
from por_historico x
where h.id = x.id;

comment on column public.wvetro_historico_suprimentos.produto_atlas_id is
  'Produto Atlas associado por identificadores W.Vetro seguros. Não movimenta estoque nem altera custo oficial.';

comment on column public.wvetro_historico_suprimentos.produto_vinculo_status is
  'Estado do vínculo histórico com o catálogo Atlas: seguro, pendente ou ambiguo.';

commit;
