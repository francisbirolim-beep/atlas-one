create table if not exists public.pacotes_tecnicos (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid references public.orcamentos(id) on delete cascade,
  venda_obra_id uuid references public.vendas_obras(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  obra_id uuid references public.obras(id) on delete set null,
  origem text not null default 'orcamento_simulacao' check (origem in ('orcamento_simulacao','projeto_conferido','revisao','medicao_final')),
  versao integer not null default 1 check (versao > 0),
  status text not null default 'rascunho' check (status in ('rascunho','calculado','conferido','liberado','substituido')),
  perda_corte_mm numeric not null default 0 check (perda_corte_mm >= 0),
  minimo_sobra_reaproveitavel_mm numeric not null default 0 check (minimo_sobra_reaproveitavel_mm >= 0),
  custo_previsto numeric,
  custo_otimizado numeric,
  snapshot_itens jsonb not null default '[]'::jsonb,
  observacoes text,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pacotes_tecnicos_orcamento_origem_versao_uq
  on public.pacotes_tecnicos(orcamento_id, origem, versao)
  where orcamento_id is not null;
create index if not exists pacotes_tecnicos_obra_idx on public.pacotes_tecnicos(obra_id, created_at desc);
create index if not exists pacotes_tecnicos_venda_idx on public.pacotes_tecnicos(venda_obra_id, created_at desc);

create table if not exists public.pacote_tecnico_materiais (
  id uuid primary key default gen_random_uuid(),
  pacote_id uuid not null references public.pacotes_tecnicos(id) on delete cascade,
  item_ref text,
  categoria text not null check (categoria in ('perfil','acessorio','vidro','outro','contramarco')),
  produto_id uuid references public.produtos(id) on delete set null,
  codigo text,
  descricao text not null,
  unidade text not null default 'UN',
  cor_ref text,
  quantidade_tecnica numeric not null default 0 check (quantidade_tecnica >= 0),
  quantidade_ajustada numeric not null default 0 check (quantidade_ajustada >= 0),
  comprimento_corte_mm numeric,
  comprimento_barra_mm numeric,
  origem_calculo text not null default 'formula' check (origem_calculo in ('formula','receita','manual','revisao','medicao')),
  status_calculo text not null default 'calculado' check (status_calculo in ('calculado','pendente_formula','manual')),
  incluido_manual boolean not null default false,
  excluido boolean not null default false,
  justificativa_ajuste text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pacote_tecnico_materiais_pacote_idx on public.pacote_tecnico_materiais(pacote_id, categoria, ordem);
create index if not exists pacote_tecnico_materiais_produto_idx on public.pacote_tecnico_materiais(produto_id);

create table if not exists public.estoque_sobras_perfis (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete restrict,
  cor_ref text,
  comprimento_mm numeric not null check (comprimento_mm > 0),
  status text not null default 'disponivel' check (status in ('disponivel','reservada','consumida','descartada')),
  local_id uuid references public.estoque_locais(id) on delete set null,
  endereco_id uuid references public.estoque_enderecos(id) on delete set null,
  obra_origem_id uuid references public.obras(id) on delete set null,
  ordem_producao_origem_id uuid references public.ordens_producao(id) on delete set null,
  plano_corte_origem_id uuid references public.planos_corte(id) on delete set null,
  pacote_reserva_id uuid references public.pacotes_tecnicos(id) on delete set null,
  obra_reserva_id uuid references public.obras(id) on delete set null,
  custo_residual numeric,
  observacoes text,
  criado_por_id uuid,
  criado_por_nome text,
  reservado_por_id uuid,
  reservado_por_nome text,
  reservado_em timestamptz,
  consumido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists estoque_sobras_perfis_disponiveis_idx on public.estoque_sobras_perfis(produto_id, cor_ref, comprimento_mm) where status='disponivel';
create index if not exists estoque_sobras_perfis_reserva_idx on public.estoque_sobras_perfis(pacote_reserva_id, status);

create table if not exists public.pacote_tecnico_barras (
  id uuid primary key default gen_random_uuid(),
  pacote_id uuid not null references public.pacotes_tecnicos(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  cor_ref text,
  fonte_tipo text not null default 'barra_nova' check (fonte_tipo in ('barra_nova','sobra_estoque')),
  sobra_estoque_id uuid references public.estoque_sobras_perfis(id) on delete set null,
  comprimento_inicial_mm numeric not null check (comprimento_inicial_mm > 0),
  comprimento_usado_mm numeric not null default 0 check (comprimento_usado_mm >= 0),
  sobra_final_mm numeric not null default 0 check (sobra_final_mm >= 0),
  reaproveitavel boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pacote_tecnico_barras_pacote_idx on public.pacote_tecnico_barras(pacote_id, produto_id, ordem);

create table if not exists public.pacote_tecnico_cortes (
  id uuid primary key default gen_random_uuid(),
  barra_id uuid not null references public.pacote_tecnico_barras(id) on delete cascade,
  material_id uuid references public.pacote_tecnico_materiais(id) on delete set null,
  item_ref text,
  codigo text,
  comprimento_mm numeric not null check (comprimento_mm > 0),
  perda_corte_mm numeric not null default 0 check (perda_corte_mm >= 0),
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists pacote_tecnico_cortes_barra_idx on public.pacote_tecnico_cortes(barra_id, ordem);

create table if not exists public.pacote_tecnico_separacoes (
  id uuid primary key default gen_random_uuid(),
  pacote_id uuid not null references public.pacotes_tecnicos(id) on delete cascade,
  material_id uuid references public.pacote_tecnico_materiais(id) on delete set null,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  tipo_origem text not null check (tipo_origem in ('barra_inteira_estoque','sobra_estoque','manual')),
  estoque_reserva_id uuid references public.estoque_reservas(id) on delete set null,
  sobra_estoque_id uuid references public.estoque_sobras_perfis(id) on delete set null,
  local_id uuid references public.estoque_locais(id) on delete set null,
  endereco_id uuid references public.estoque_enderecos(id) on delete set null,
  quantidade numeric not null default 0 check (quantidade >= 0),
  comprimento_disponivel_mm numeric,
  comprimento_utilizado_mm numeric,
  status text not null default 'separado' check (status in ('separado','reservado','consumido','devolvido','cancelado')),
  observacoes text,
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pacote_tecnico_separacoes_pacote_idx on public.pacote_tecnico_separacoes(pacote_id, produto_id, status);

create table if not exists public.pacote_tecnico_compras (
  id uuid primary key default gen_random_uuid(),
  pacote_id uuid not null references public.pacotes_tecnicos(id) on delete cascade,
  material_id uuid references public.pacote_tecnico_materiais(id) on delete set null,
  categoria text not null check (categoria in ('perfil','acessorio','vidro','outro','contramarco')),
  produto_id uuid references public.produtos(id) on delete set null,
  codigo text,
  descricao text not null,
  unidade text not null default 'UN',
  comprimento_barra_mm numeric,
  quantidade_calculada numeric not null default 0 check (quantidade_calculada >= 0),
  quantidade_ajustada numeric not null default 0 check (quantidade_ajustada >= 0),
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  origem text not null default 'automatico' check (origem in ('automatico','manual')),
  excluido boolean not null default false,
  justificativa_ajuste text,
  status text not null default 'pendente' check (status in ('pendente','aprovado','enviado','comprado','cancelado')),
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pacote_tecnico_compras_pacote_idx on public.pacote_tecnico_compras(pacote_id, categoria, status);

alter table public.pacotes_tecnicos enable row level security;
alter table public.pacote_tecnico_materiais enable row level security;
alter table public.estoque_sobras_perfis enable row level security;
alter table public.pacote_tecnico_barras enable row level security;
alter table public.pacote_tecnico_cortes enable row level security;
alter table public.pacote_tecnico_separacoes enable row level security;
alter table public.pacote_tecnico_compras enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pacotes_tecnicos','pacote_tecnico_materiais','estoque_sobras_perfis','pacote_tecnico_barras','pacote_tecnico_cortes','pacote_tecnico_separacoes','pacote_tecnico_compras'] loop
    execute format('drop policy if exists %I on public.%I', t || '_auth_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t || '_auth_all', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['pacotes_tecnicos','pacote_tecnico_materiais','estoque_sobras_perfis','pacote_tecnico_barras','pacote_tecnico_separacoes','pacote_tecnico_compras'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.update_updated_at()', t || '_updated_at', t);
  end loop;
end $$;
