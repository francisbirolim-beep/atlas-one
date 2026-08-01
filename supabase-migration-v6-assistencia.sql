-- Atlas One v6: módulo de Assistência Técnica (separado do fluxo de Orçamento)

create table if not exists assistencias (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  atualizado_em timestamptz default now(),

  cliente_id uuid references clientes(id),
  cliente_nome text not null,
  cliente_whatsapp text,
  cidade text,
  endereco text,

  descricao_problema text not null,
  fotos_urls text[] default '{}',

  status text not null default 'aberto', -- aberto, em_atendimento, resolvido

  criado_por_nome text,
  criado_por_id uuid
);

create index if not exists idx_assistencias_status on assistencias(status);
create index if not exists idx_assistencias_cliente_id on assistencias(cliente_id);
create index if not exists idx_assistencias_created_at on assistencias(created_at desc);

alter table assistencias enable row level security;
drop policy if exists "acesso_total_temporario" on assistencias;
create policy "acesso_total_temporario" on assistencias
  for all using (true) with check (true);
