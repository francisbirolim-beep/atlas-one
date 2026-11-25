-- Base aditiva; não altera atendimento, usuários ou vínculos existentes.
begin;
set local lock_timeout='1s';
set local statement_timeout='10s';
create table public.atlas_chat_arrobas (
 empresa_id uuid not null,
 usuario_id uuid not null,
 apelido text not null check(apelido ~ '^[a-z][a-z0-9_]{1,29}$' and apelido not in ('central','todos','equipe','admin','master')),
 nome_publico text not null check(length(btrim(nome_publico)) between 1 and 80),
 publico boolean not null default false,
 atualizado_por uuid,
 updated_at timestamptz not null default now(),
 primary key(empresa_id,usuario_id),
 unique(empresa_id,apelido),
 foreign key(empresa_id,usuario_id) references public.usuarios(empresa_id,id) on delete cascade,
 foreign key(empresa_id,atualizado_por) references public.usuarios(empresa_id,id) on delete set null (atualizado_por)
);
alter table public.atlas_chat_arrobas enable row level security;
revoke all on public.atlas_chat_arrobas from public,anon,authenticated,service_role;
grant select,insert,update on public.atlas_chat_arrobas to service_role;
commit;
