create table if not exists public.wvetro_orcamentos_historico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default private.current_empresa_id() references public.empresas(id),
  cliente_id uuid null references public.clientes(id) on delete set null,
  wvetro_chave text not null,
  wvetro_numero text not null,
  cliente_nome text null,
  cliente_documento text null,
  cidade text null,
  obra_nome text null,
  vendedor_nome text null,
  situacao text null,
  data_emissao date null,
  data_venda date null,
  valor_bruto numeric null,
  valor_total numeric null,
  custo_com_sobra numeric null,
  custo_sem_sobra numeric null,
  total_m2 numeric null,
  itens_qtd integer null,
  match_status text not null default 'pendente'
    check (match_status in ('vinculado','pendente','revisao')),
  match_metodo text null,
  match_confianca numeric(5,4) null
    check (match_confianca is null or (match_confianca >= 0 and match_confianca <= 1)),
  payload_hash text null,
  neon_recurso text not null default 'orcamentos',
  capturado_em timestamptz null,
  importado_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_wvetro_orcamentos_historico_empresa_chave unique (empresa_id,wvetro_chave)
);

create index if not exists idx_wvetro_orcamentos_historico_cliente
  on public.wvetro_orcamentos_historico(empresa_id,cliente_id,data_emissao desc);

create index if not exists idx_wvetro_orcamentos_historico_match
  on public.wvetro_orcamentos_historico(empresa_id,match_status,data_emissao desc);

create index if not exists idx_wvetro_orcamentos_historico_numero
  on public.wvetro_orcamentos_historico(empresa_id,wvetro_numero);

alter table public.wvetro_orcamentos_historico enable row level security;

drop policy if exists wvetro_orc_hist_select_empresa on public.wvetro_orcamentos_historico;
create policy wvetro_orc_hist_select_empresa
  on public.wvetro_orcamentos_historico for select
  using (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_orc_hist_insert_empresa on public.wvetro_orcamentos_historico;
create policy wvetro_orc_hist_insert_empresa
  on public.wvetro_orcamentos_historico for insert
  with check (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_orc_hist_update_empresa on public.wvetro_orcamentos_historico;
create policy wvetro_orc_hist_update_empresa
  on public.wvetro_orcamentos_historico for update
  using (empresa_id = (select private.current_empresa_id()))
  with check (empresa_id = (select private.current_empresa_id()));

drop policy if exists wvetro_orc_hist_delete_empresa on public.wvetro_orcamentos_historico;
create policy wvetro_orc_hist_delete_empresa
  on public.wvetro_orcamentos_historico for delete
  using (empresa_id = (select private.current_empresa_id()));

revoke all on public.wvetro_orcamentos_historico from anon;
grant select on public.wvetro_orcamentos_historico to authenticated;
grant all on public.wvetro_orcamentos_historico to service_role;
