-- Configuração isolada; não altera a fila nem permissões de canais atuais.
create table if not exists public.atendimento_whatsapp_distribuicao (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  usuario_principal_id uuid references public.usuarios(id) on delete set null,
  secundarios_ids uuid[] not null default '{}',
  prazo_minutos integer not null default 10 check (prazo_minutos between 1 and 1440),
  ativo boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.atendimento_whatsapp_distribuicao enable row level security;
revoke all on public.atendimento_whatsapp_distribuicao from anon, authenticated;
grant select, insert, update on public.atendimento_whatsapp_distribuicao to service_role;
