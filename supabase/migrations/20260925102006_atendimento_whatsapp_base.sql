
create table if not exists public.atendimento_conversas (
 id uuid primary key default gen_random_uuid(),
 canal text not null default 'whatsapp' check (canal in ('whatsapp')),
 telefone text not null,
 cliente_id uuid references public.clientes(id) on delete set null,
 status text not null default 'aguardando' check (status in ('aguardando','em_atendimento','aguardando_cliente','transferido','finalizado')),
 responsavel_id uuid references public.usuarios(id) on delete set null,
 responsavel_nome text,
 setor text,
 ultima_mensagem_em timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists atendimento_conversas_status_idx on public.atendimento_conversas(status);
create index if not exists atendimento_conversas_telefone_idx on public.atendimento_conversas(telefone);

create table if not exists public.atendimento_sessoes (
 id uuid primary key default gen_random_uuid(),
 conversa_id uuid not null references public.atendimento_conversas(id) on delete cascade,
 status text not null default 'aguardando' check (status in ('aguardando','em_atendimento','aguardando_cliente','transferido','finalizado')),
 responsavel_id uuid references public.usuarios(id) on delete set null,
 responsavel_nome text,
 setor text,
 queued_at timestamptz not null default now(),
 assigned_at timestamptz,
 first_response_at timestamptz,
 closed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists atendimento_sessoes_conversa_idx on public.atendimento_sessoes(conversa_id, created_at desc);

create table if not exists public.atendimento_mensagens (
 id uuid primary key default gen_random_uuid(),
 conversa_id uuid not null references public.atendimento_conversas(id) on delete cascade,
 sessao_id uuid references public.atendimento_sessoes(id) on delete set null,
 direcao text not null check (direcao in ('entrada','saida','interna')),
 tipo text not null default 'texto' check (tipo in ('texto','imagem','audio','video','documento','localizacao','contato','sistema')),
 texto text,
 media_url text,
 whatsapp_message_id text unique,
 usuario_id uuid references public.usuarios(id) on delete set null,
 usuario_nome text,
 created_at timestamptz not null default now()
);
create index if not exists atendimento_mensagens_conversa_idx on public.atendimento_mensagens(conversa_id, created_at);

create table if not exists public.atendimento_eventos (
 id uuid primary key default gen_random_uuid(),
 conversa_id uuid not null references public.atendimento_conversas(id) on delete cascade,
 sessao_id uuid references public.atendimento_sessoes(id) on delete set null,
 tipo text not null,
 usuario_id uuid references public.usuarios(id) on delete set null,
 usuario_nome text,
 dados jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists atendimento_eventos_sessao_idx on public.atendimento_eventos(sessao_id, created_at);

alter table public.atendimento_conversas enable row level security;
alter table public.atendimento_sessoes enable row level security;
alter table public.atendimento_mensagens enable row level security;
alter table public.atendimento_eventos enable row level security;

grant select,insert,update on public.atendimento_conversas to authenticated;
grant select,insert,update on public.atendimento_sessoes to authenticated;
grant select,insert on public.atendimento_mensagens to authenticated;
grant select,insert on public.atendimento_eventos to authenticated;

create policy "atendimento_conversas_auth_select" on public.atendimento_conversas for select to authenticated using ((select auth.uid()) is not null);
create policy "atendimento_conversas_auth_insert" on public.atendimento_conversas for insert to authenticated with check ((select auth.uid()) is not null);
create policy "atendimento_conversas_auth_update" on public.atendimento_conversas for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "atendimento_sessoes_auth_select" on public.atendimento_sessoes for select to authenticated using ((select auth.uid()) is not null);
create policy "atendimento_sessoes_auth_insert" on public.atendimento_sessoes for insert to authenticated with check ((select auth.uid()) is not null);
create policy "atendimento_sessoes_auth_update" on public.atendimento_sessoes for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
create policy "atendimento_mensagens_auth_select" on public.atendimento_mensagens for select to authenticated using ((select auth.uid()) is not null);
create policy "atendimento_mensagens_auth_insert" on public.atendimento_mensagens for insert to authenticated with check ((select auth.uid()) is not null);
create policy "atendimento_eventos_auth_select" on public.atendimento_eventos for select to authenticated using ((select auth.uid()) is not null);
create policy "atendimento_eventos_auth_insert" on public.atendimento_eventos for insert to authenticated with check ((select auth.uid()) is not null);

alter publication supabase_realtime add table public.atendimento_conversas;
alter publication supabase_realtime add table public.atendimento_mensagens;
