create table if not exists public.chat_conversas (
 id uuid primary key default gen_random_uuid(), nome text check (nome is null or length(trim(nome)) <= 100),
 tipo text not null default 'direta' check (tipo in ('direta','grupo')),
 criado_por_id uuid, criado_por_nome text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.chat_participantes (
 id uuid primary key default gen_random_uuid(), conversa_id uuid not null references public.chat_conversas(id) on delete cascade,
 usuario_id uuid not null, usuario_nome text check (usuario_nome is null or length(trim(usuario_nome)) <= 200),
 ultima_leitura_em timestamptz, created_at timestamptz not null default now(), unique(conversa_id,usuario_id)
);
create table if not exists public.chat_mensagens (
 id uuid primary key default gen_random_uuid(), conversa_id uuid not null references public.chat_conversas(id) on delete cascade,
 usuario_id uuid, usuario_nome text check (usuario_nome is null or length(trim(usuario_nome)) <= 200), texto text,
 anexo_url text, anexo_nome text, cliente_id uuid, orcamento_id uuid,
 mensagem_pai_id uuid references public.chat_mensagens(id) on delete set null, created_at timestamptz not null default now(),
 check (coalesce(length(trim(texto)),0)>0 or coalesce(length(trim(anexo_url)),0)>0),
 check (texto is null or length(trim(texto))<=10000), check (anexo_nome is null or length(trim(anexo_nome))<=255),
 check (anexo_url is null or (length(trim(anexo_url))<=2048 and trim(anexo_url) ~ '^https://'))
);
create index if not exists chat_participantes_usuario_idx on public.chat_participantes(usuario_id);
create index if not exists chat_mensagens_conversa_created_idx on public.chat_mensagens(conversa_id,created_at);
alter table public.chat_conversas enable row level security; alter table public.chat_participantes enable row level security; alter table public.chat_mensagens enable row level security;
revoke all on public.chat_conversas,public.chat_participantes,public.chat_mensagens from anon;
grant select,insert,update,delete on public.chat_conversas,public.chat_participantes,public.chat_mensagens to authenticated;
create or replace function public.atlas_chat_participa(p_conversa uuid) returns boolean language sql stable security definer set search_path=public,auth as $$ select exists(select 1 from public.chat_participantes cp where cp.conversa_id=p_conversa and cp.usuario_id=auth.uid()) $$;
revoke all on function public.atlas_chat_participa(uuid) from public,anon; grant execute on function public.atlas_chat_participa(uuid) to authenticated;
drop policy if exists chat_conversas_acesso_atlas on public.chat_conversas; drop policy if exists chat_conversas_select on public.chat_conversas; drop policy if exists chat_conversas_insert on public.chat_conversas; drop policy if exists chat_conversas_update on public.chat_conversas; drop policy if exists chat_conversas_delete on public.chat_conversas;
create policy chat_conversas_select on public.chat_conversas for select to authenticated using (public.atlas_chat_participa(id));
create policy chat_conversas_insert on public.chat_conversas for insert to authenticated with check (criado_por_id=auth.uid());
create policy chat_conversas_update on public.chat_conversas for update to authenticated using (public.atlas_chat_participa(id)) with check (public.atlas_chat_participa(id));
create policy chat_conversas_delete on public.chat_conversas for delete to authenticated using (criado_por_id=auth.uid());
drop policy if exists chat_participantes_acesso_atlas on public.chat_participantes; drop policy if exists chat_participantes_select on public.chat_participantes; drop policy if exists chat_participantes_insert on public.chat_participantes; drop policy if exists chat_participantes_update on public.chat_participantes; drop policy if exists chat_participantes_delete on public.chat_participantes;
create policy chat_participantes_select on public.chat_participantes for select to authenticated using (public.atlas_chat_participa(conversa_id));
create policy chat_participantes_insert on public.chat_participantes for insert to authenticated with check (exists(select 1 from public.chat_conversas c where c.id=conversa_id and c.criado_por_id=auth.uid()));
create policy chat_participantes_update on public.chat_participantes for update to authenticated using (usuario_id=auth.uid()) with check (usuario_id=auth.uid());
create policy chat_participantes_delete on public.chat_participantes for delete to authenticated using (usuario_id=auth.uid() or exists(select 1 from public.chat_conversas c where c.id=conversa_id and c.criado_por_id=auth.uid()));
drop policy if exists chat_mensagens_acesso_atlas on public.chat_mensagens; drop policy if exists chat_mensagens_select on public.chat_mensagens; drop policy if exists chat_mensagens_insert on public.chat_mensagens;
create policy chat_mensagens_select on public.chat_mensagens for select to authenticated using (public.atlas_chat_participa(conversa_id));
create policy chat_mensagens_insert on public.chat_mensagens for insert to authenticated with check (usuario_id=auth.uid() and public.atlas_chat_participa(conversa_id));
