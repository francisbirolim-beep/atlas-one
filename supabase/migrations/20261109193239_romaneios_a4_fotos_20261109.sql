-- Romaneios por cliente/obra; isolado dos pedidos e do estoque existentes.
-- Cada registro corresponde a uma única folha A4 (até 10 linhas com foto).
create table if not exists public.romaneios (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  empresa_id uuid not null default private.current_empresa_id() references public.empresas(id),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  obra_id uuid null references public.obras(id) on delete set null,
  cliente_nome_impresso text not null,
  obra_nome_impresso text not null,
  endereco_obra text not null default '',
  tipo text not null default 'pintura' check (tipo in ('pintura','perfis','vidros','acessorios','misto')),
  data_emissao date not null default current_date,
  destino text not null default '',
  cor text not null default '',
  codigo_cor text not null default '',
  acabamento text not null default '',
  observacoes text not null default '',
  entregue_por text not null default '',
  recebido_por text not null default '',
  status text not null default 'rascunho' check (status in ('rascunho','aguardando_envio','enviado','recebido','concluido')),
  itens jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint romaneios_a4_max_10_itens check (jsonb_typeof(itens)='array' and jsonb_array_length(itens) between 1 and 10),
  constraint romaneios_pintura_exige_cor check (tipo <> 'pintura' or btrim(cor) <> ''),
  constraint romaneios_identificacao_preenchida check (btrim(cliente_nome_impresso)<>'' and btrim(obra_nome_impresso)<>'')
);

create index if not exists idx_romaneios_cliente_data
  on public.romaneios (empresa_id, cliente_id, created_at desc);
create index if not exists idx_romaneios_obra
  on public.romaneios (empresa_id, obra_id);

alter table public.romaneios enable row level security;
revoke all on table public.romaneios from public, anon;
grant select, insert, update on table public.romaneios to authenticated;

-- Cada linha aponta a um produto real da própria empresa, com foto cadastrada.
-- A impressão também utiliza os dados atuais desse produto; não há produto avulso.
create policy romaneios_empresa_select on public.romaneios
  for select to authenticated
  using (empresa_id = (select private.current_empresa_id()));

create policy romaneios_empresa_insert on public.romaneios
  for insert to authenticated
  with check (
    empresa_id = (select private.current_empresa_id())
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.empresa_id = (select private.current_empresa_id())
    )
    and (obra_id is null or exists (
      select 1 from public.obras o
      where o.id = obra_id and o.cliente_id = cliente_id
        and o.empresa_id = (select private.current_empresa_id())
    ))
    and not exists (
      select 1 from jsonb_array_elements(itens) j
      left join public.produtos p on p.id::text = j->>'produto_id'
      where p.id is null or p.empresa_id <> (select private.current_empresa_id())
        or nullif(btrim(p.foto_url),'') is null
    )
  );

create policy romaneios_empresa_update on public.romaneios
  for update to authenticated
  using (empresa_id = (select private.current_empresa_id()))
  with check (
    empresa_id = (select private.current_empresa_id())
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.empresa_id = (select private.current_empresa_id())
    )
    and (obra_id is null or exists (
      select 1 from public.obras o
      where o.id = obra_id and o.cliente_id = cliente_id
        and o.empresa_id = (select private.current_empresa_id())
    ))
    and not exists (
      select 1 from jsonb_array_elements(itens) j
      left join public.produtos p on p.id::text = j->>'produto_id'
      where p.id is null or p.empresa_id <> (select private.current_empresa_id())
        or nullif(btrim(p.foto_url),'') is null
    )
  );