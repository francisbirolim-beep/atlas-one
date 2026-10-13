-- Relatório WVetro "Barras Utilizadas" é fonte exclusiva das barras comerciais.
-- Nunca misturar com pacote_tecnico_materiais, que guarda as peças cortadas.
create table if not exists public.venda_wvetro_barras (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id),
 venda_obra_id uuid not null references public.vendas_obras(id) on delete cascade,
 orcamento_id uuid not null references public.orcamentos(id),
 numero_wvetro text not null,
 chave_origem text not null,
 hash_pdf text not null,
 codigo_origem text not null,
 descricao_origem text not null,
 tipo_origem text not null,
 tratamento_origem text not null,
 quantidade_origem integer not null check(quantidade_origem>=0),
 tamanho_origem_mm integer not null check(tamanho_origem_mm>=100),
 codigo text not null,
 descricao text not null,
 tipo text not null,
 tratamento text not null,
 quantidade_barras integer not null check(quantidade_barras>=0 and quantidade_barras<=10000),
 tamanho_barra_mm integer not null check(tamanho_barra_mm>=100 and tamanho_barra_mm<=15000),
 peso_kg numeric null,
 sobra_kg numeric null,
 status_validacao text not null default 'pendente' check(status_validacao in ('pendente','validado','corrigido')),
 status_compra text not null default 'necessidade' check(status_compra in ('necessidade','cotacao','comprado','entrega','recebido')),
 observacao_correcao text null,
 validado_em timestamptz null,
 validado_por_id uuid null,
 validado_por_nome text null,
 atualizado_por_id uuid null,
 atualizado_por_nome text null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(venda_obra_id,chave_origem)
);
create index if not exists venda_wvetro_barras_empresa_venda_idx on public.venda_wvetro_barras (empresa_id,venda_obra_id,status_compra);
alter table public.venda_wvetro_barras enable row level security;
drop policy if exists venda_wvetro_barras_empresa_read on public.venda_wvetro_barras;
create policy venda_wvetro_barras_empresa_read on public.venda_wvetro_barras for select to authenticated
 using (empresa_id=private.current_empresa_id());
revoke all on public.venda_wvetro_barras from public,anon,authenticated;
grant select on public.venda_wvetro_barras to authenticated;
grant all on public.venda_wvetro_barras to service_role;

create table if not exists public.venda_wvetro_barras_aprendizado (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id),
 venda_obra_id uuid not null references public.vendas_obras(id) on delete cascade,
 barra_id uuid not null references public.venda_wvetro_barras(id) on delete cascade,
 evento text not null check(evento in ('validacao','correcao','mudanca_etapa')),
 dados_antes jsonb not null,
 dados_depois jsonb not null,
 justificativa text null,
 validado_por_id uuid null,
 validado_por_nome text null,
 created_at timestamptz not null default now()
);
create index if not exists venda_wvetro_barras_aprendizado_idx on public.venda_wvetro_barras_aprendizado(empresa_id,venda_obra_id,created_at desc);
alter table public.venda_wvetro_barras_aprendizado enable row level security;
drop policy if exists venda_wvetro_barras_aprendizado_read on public.venda_wvetro_barras_aprendizado;
create policy venda_wvetro_barras_aprendizado_read on public.venda_wvetro_barras_aprendizado for select to authenticated
 using (empresa_id=private.current_empresa_id());
revoke all on public.venda_wvetro_barras_aprendizado from public,anon,authenticated;
grant select on public.venda_wvetro_barras_aprendizado to authenticated;
grant all on public.venda_wvetro_barras_aprendizado to service_role;
