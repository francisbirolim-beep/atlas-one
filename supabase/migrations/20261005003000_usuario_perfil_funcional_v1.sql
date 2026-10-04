-- Perfil funcional editável dos usuários do Atlas
alter table public.usuarios
  add column if not exists cargo text null,
  add column if not exists setor_principal_id text null references public.setores(id) on delete set null,
  add column if not exists observacoes_perfil text null;

create index if not exists usuarios_setor_principal_idx
  on public.usuarios(setor_principal_id)
  where setor_principal_id is not null;

comment on column public.usuarios.cargo is 'Cargo ou função interna do usuário.';
comment on column public.usuarios.setor_principal_id is 'Setor principal do usuário; permissões adicionais continuam na tabela permissoes.';
comment on column public.usuarios.observacoes_perfil is 'Observações internas sobre responsabilidades e perfil funcional.';
