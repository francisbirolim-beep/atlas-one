-- RASCUNHO PARA HOMOLOGACAO. Não executar em produção.
-- Índices compostos permitem FKs de tenant sem confiar apenas no backend.
-- Revisar impacto/locks e gerar migration oficial antes de aplicar.
begin;
create unique index if not exists atlas_chat_usuarios_tenant_uidx on public.usuarios(empresa_id,id);
create unique index if not exists atlas_chat_canais_tenant_uidx on public.atendimento_whatsapp_canais(empresa_id,id);
create table public.atlas_chat_acessos (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid not null,
  habilitado boolean not null default false,
  atualizado_por uuid,
  updated_at timestamptz not null default now(),
  primary key (empresa_id,usuario_id),
  foreign key (empresa_id,usuario_id) references public.usuarios(empresa_id,id) on delete cascade,
  foreign key (empresa_id,atualizado_por) references public.usuarios(empresa_id,id) on delete set null (atualizado_por)
);
create table public.atlas_chat_vinculos (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid not null,
  telefone text not null check (telefone ~ '^55[1-9][0-9]{9,10}$'),
  responsavel_id uuid,
  atualizado_por uuid,
  updated_at timestamptz not null default now(),
  primary key (empresa_id,canal_id,telefone),
  foreign key (empresa_id,canal_id) references public.atendimento_whatsapp_canais(empresa_id,id) on delete cascade,
  foreign key (empresa_id,responsavel_id) references public.usuarios(empresa_id,id) on delete set null (responsavel_id),
  foreign key (empresa_id,atualizado_por) references public.usuarios(empresa_id,id) on delete set null (atualizado_por)
);
-- Uma linha sem responsável representa retorno explícito à central; não apagar a linha.
alter table public.atlas_chat_acessos enable row level security;
alter table public.atlas_chat_vinculos enable row level security;
revoke all on public.atlas_chat_acessos,public.atlas_chat_vinculos from public,anon,authenticated;
grant select,insert,update on public.atlas_chat_acessos,public.atlas_chat_vinculos to service_role;
commit;
