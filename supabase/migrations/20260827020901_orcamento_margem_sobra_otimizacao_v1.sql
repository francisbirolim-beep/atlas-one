alter table public.orcamentos
  add column if not exists margem_padrao_pct numeric not null default 40 check (margem_padrao_pct >= 0 and margem_padrao_pct < 100),
  add column if not exists cobrar_sobra_padrao boolean not null default false,
  add column if not exists custo_otimizado numeric,
  add column if not exists custo_sobra_cobrada numeric,
  add column if not exists otimizacao_orcamento jsonb not null default '{}'::jsonb;

insert into public.configuracoes_precificacao(chave,valor,updated_at)
values('margem_padrao_orcamento',40,now())
on conflict (chave) do nothing;

comment on column public.orcamentos.margem_padrao_pct is 'Margem comercial padrão congelada no orçamento; itens podem sobrescrever no JSON itens.';
comment on column public.orcamentos.cobrar_sobra_padrao is 'Política padrão do orçamento para repassar custo da sobra; itens podem sobrescrever individualmente.';
comment on column public.orcamentos.custo_sobra_cobrada is 'Parcela de sobra repassada a custo, sem aplicação da margem comercial.';
comment on column public.orcamentos.otimizacao_orcamento is 'Snapshot da simulação de aproveitamento de barras do orçamento; não representa reserva física de estoque.';
