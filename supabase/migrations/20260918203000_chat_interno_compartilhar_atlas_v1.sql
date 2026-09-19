-- Chat interno + caixa de entrada de compartilhamentos do Atlas One V1
create table if not exists public.chat_conversas (
  id uuid primary key default gen_random_uuid(),
  nome text,
  tipo text not null default 'direta' check (tipo in ('direta','grupo')),
  criado_por_id uuid,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_participantes (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.chat_conversas(id) on delete cascade,
  usuario_id uuid not null,
  usuario_nome text,
  ultima_leitura_em timestamptz,
  created_at timestamptz not null default now(),
  unique (conversa_id, usuario_id)
);

create table if not exists public.chat_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.chat_conversas(id) on delete cascade,
  usuario_id uuid,
  usuario_nome text,
  texto text,
  anexo_url text,
  anexo_nome text,
  cliente_id uuid,
  orcamento_id uuid,
  mensagem_pai_id uuid references public.chat_mensagens(id) on delete set null,
  created_at timestamptz not null default now(),
  check (coalesce(length(trim(texto)),0) > 0 or anexo_url is not null),
  check (texto is null or length(trim(texto)) <= 10000)
);

create index if not exists chat_participantes_usuario_idx on public.chat_participantes(usuario_id);
create index if not exists chat_mensagens_conversa_created_idx on public.chat_mensagens(conversa_id, created_at);
create index if not exists chat_mensagens_cliente_idx on public.chat_mensagens(cliente_id) where cliente_id is not null;
create index if not exists chat_mensagens_orcamento_idx on public.chat_mensagens(orcamento_id) where orcamento_id is not null;

alter table public.chat_conversas enable row level security;
alter table public.chat_participantes enable row level security;
alter table public.chat_mensagens enable row level security;

-- O Atlas ainda usa login proprio em usuarios; manter o mesmo padrao operacional
-- atual do projeto nesta V1. Hardening de autorizacao profunda fica separado.
drop policy if exists "chat_conversas_acesso_atlas" on public.chat_conversas;
create policy "chat_conversas_acesso_atlas" on public.chat_conversas for all using (true) with check (true);
drop policy if exists "chat_participantes_acesso_atlas" on public.chat_participantes;
create policy "chat_participantes_acesso_atlas" on public.chat_participantes for all using (true) with check (true);
drop policy if exists "chat_mensagens_acesso_atlas" on public.chat_mensagens;
create policy "chat_mensagens_acesso_atlas" on public.chat_mensagens for all using (true) with check (true);

grant select, insert, update, delete on public.chat_conversas to anon, authenticated;
grant select, insert, update, delete on public.chat_participantes to anon, authenticated;
grant select, insert, update, delete on public.chat_mensagens to anon, authenticated;
