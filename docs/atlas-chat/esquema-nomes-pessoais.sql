-- Aditivo: nome pessoal não altera cadastro, responsável, mensagem ou grupo.
begin;
set local lock_timeout='1s';
set local statement_timeout='10s';
create table public.atlas_chat_nomes_pessoais (
 empresa_id uuid not null,
 usuario_id uuid not null,
 canal_id uuid not null,
 telefone text not null check(telefone ~ '^55[1-9][0-9]{9,10}$'),
 nome text not null check(length(btrim(nome)) between 1 and 120),
 updated_at timestamptz not null default now(),
 primary key(empresa_id,usuario_id,canal_id,telefone),
 foreign key(empresa_id,usuario_id) references public.usuarios(empresa_id,id) on delete cascade,
 foreign key(empresa_id,canal_id) references public.atendimento_whatsapp_canais(empresa_id,id) on delete cascade
);
alter table public.atlas_chat_nomes_pessoais enable row level security;
revoke all on public.atlas_chat_nomes_pessoais from public,anon,authenticated,service_role;
grant select,insert,update on public.atlas_chat_nomes_pessoais to service_role;
commit;
