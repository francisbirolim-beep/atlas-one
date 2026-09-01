create table if not exists public.historico_precos_compra (
  id uuid primary key default gen_random_uuid(),
  nf_item_id uuid not null references public.compras_nf_itens(id) on delete restrict,
  nf_id uuid not null references public.compras_nfs(id) on delete restrict,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  fornecedor_nome text,
  produto_codigo text,
  produto_nome text not null,
  produto_categoria text,
  data_compra timestamptz not null,
  quantidade numeric not null default 0,
  unidade text,
  valor_unitario_nf numeric,
  custo_aquisicao_unitario numeric,
  custo_referencia_anterior numeric,
  tipo_evento text not null default 'compra' check (tipo_evento in ('compra','vinculo_produto','correcao_compra')),
  origem text not null default 'nf_entrada',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_hist_preco_compra_produto_data on public.historico_precos_compra(produto_id,data_compra desc,created_at desc);
create index if not exists idx_hist_preco_compra_fornecedor on public.historico_precos_compra(fornecedor_id,produto_id,data_compra desc);
create index if not exists idx_hist_preco_compra_nf_item on public.historico_precos_compra(nf_item_id,created_at desc);

alter table public.historico_precos_compra enable row level security;
drop policy if exists historico_precos_compra_auth_read on public.historico_precos_compra;
create policy historico_precos_compra_auth_read on public.historico_precos_compra for select to authenticated using (auth.uid() is not null);
grant select on public.historico_precos_compra to authenticated;
revoke insert,update,delete on public.historico_precos_compra from anon,authenticated;

drop trigger if exists trg_historico_precos_compra_imutavel on public.historico_precos_compra;
create trigger trg_historico_precos_compra_imutavel before update or delete on public.historico_precos_compra for each row execute function public.fn_historico_imutavel_v1();

create or replace function public.fn_historico_preco_compra_nf_item_v1()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nf public.compras_nfs%rowtype;
  v_produto public.produtos%rowtype;
  v_evento text := 'compra';
begin
  if new.produto_id is null then return new; end if;
  if tg_op='UPDATE' then
    if old.produto_id is not distinct from new.produto_id
       and old.nf_id is not distinct from new.nf_id
       and old.quantidade is not distinct from new.quantidade
       and old.unidade is not distinct from new.unidade
       and old.valor_unitario is not distinct from new.valor_unitario
       and old.custo_unitario is not distinct from new.custo_unitario
       and old.custo_aquisicao_unitario is not distinct from new.custo_aquisicao_unitario
       and old.fator_conversao is not distinct from new.fator_conversao then
      return new;
    end if;
    if old.produto_id is null and new.produto_id is not null then v_evento:='vinculo_produto'; else v_evento:='correcao_compra'; end if;
  end if;

  select * into v_nf from public.compras_nfs where id=new.nf_id;
  if not found then return new; end if;
  select * into v_produto from public.produtos where id=new.produto_id;
  if not found then return new; end if;

  insert into public.historico_precos_compra(
    nf_item_id,nf_id,produto_id,fornecedor_id,fornecedor_nome,produto_codigo,produto_nome,produto_categoria,
    data_compra,quantidade,unidade,valor_unitario_nf,custo_aquisicao_unitario,custo_referencia_anterior,
    tipo_evento,origem,snapshot
  ) values (
    new.id,new.nf_id,new.produto_id,v_nf.fornecedor_id,v_nf.fornecedor_nome,coalesce(v_produto.codigo,new.codigo_fornecedor),v_produto.nome,v_produto.categoria,
    coalesce(v_nf.data_emissao,v_nf.data_entrada,new.created_at,now()),new.quantidade,coalesce(new.unidade_estoque,new.unidade,v_produto.unidade),
    new.valor_unitario,coalesce(new.custo_aquisicao_unitario,new.custo_unitario,new.valor_unitario),new.custo_anterior,
    v_evento,coalesce(v_nf.origem_entrada,'nf_entrada'),
    jsonb_build_object('nf_numero',v_nf.numero,'nf_serie',v_nf.serie,'chave_acesso',v_nf.chave_acesso,'fornecedor_cnpj',v_nf.fornecedor_cnpj,'descricao_nf',new.descricao,'codigo_fornecedor',new.codigo_fornecedor,'quantidade',new.quantidade,'fator_conversao',new.fator_conversao,'valor_total',new.valor_total,'valor_frete_nf',v_nf.valor_frete,'valor_desconto_nf',v_nf.valor_desconto,'outras_despesas_nf',v_nf.outras_despesas)
  );
  return new;
end; $$;
revoke all on function public.fn_historico_preco_compra_nf_item_v1() from public,anon,authenticated;

drop trigger if exists trg_historico_preco_compra_nf_item on public.compras_nf_itens;
create trigger trg_historico_preco_compra_nf_item after insert or update on public.compras_nf_itens for each row execute function public.fn_historico_preco_compra_nf_item_v1();

create or replace view public.vw_historico_precos_compra_validos with (security_invoker=true) as
select distinct on (h.nf_item_id) h.*
from public.historico_precos_compra h
order by h.nf_item_id,h.created_at desc,h.id desc;
grant select on public.vw_historico_precos_compra_validos to authenticated;

create or replace view public.vw_produto_precos_compra_metricas with (security_invoker=true) as
with base as (
  select h.*,coalesce(h.custo_aquisicao_unitario,h.valor_unitario_nf) as custo_considerado,
         row_number() over(partition by h.produto_id order by h.data_compra desc,h.created_at desc,h.id desc) as rn
  from public.vw_historico_precos_compra_validos h
  where coalesce(h.custo_aquisicao_unitario,h.valor_unitario_nf) is not null
), agg as (
  select produto_id,
         max(custo_considerado) filter(where rn=1) as ultimo_custo,
         max(custo_considerado) filter(where rn=2) as custo_anterior,
         max(data_compra) filter(where rn=1) as ultima_compra_em,
         max(fornecedor_id::text) filter(where rn=1)::uuid as ultimo_fornecedor_id,
         max(fornecedor_nome) filter(where rn=1) as ultimo_fornecedor_nome,
         avg(custo_considerado) filter(where data_compra>=now()-interval '90 days') as media_90d,
         min(custo_considerado) filter(where data_compra>=now()-interval '90 days') as menor_90d,
         max(custo_considerado) filter(where data_compra>=now()-interval '90 days') as maior_90d,
         count(*) filter(where data_compra>=now()-interval '12 months') as compras_12m
  from base group by produto_id
)
select a.*,
       case when a.custo_anterior is not null and a.custo_anterior<>0 then round(((a.ultimo_custo-a.custo_anterior)/a.custo_anterior)*100,4) else null end as variacao_ultima_compra_pct
from agg a;
grant select on public.vw_produto_precos_compra_metricas to authenticated;
