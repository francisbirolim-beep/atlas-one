-- Validada em PostgreSQL isolado. Nenhum acesso existente é zerado.
begin;
create table public.usuario_acessos_etapas (
  usuario_id uuid primary key references public.usuarios(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id),
  config jsonb not null default '{"crmEscopo":"proprios","acoes":{}}'::jsonb,
  updated_at timestamptz not null default now(),
  check(jsonb_typeof(config)='object')
);
alter table public.usuario_acessos_etapas enable row level security;
revoke all on public.usuario_acessos_etapas from public,anon,authenticated;
grant select on public.usuario_acessos_etapas to authenticated;
grant all on public.usuario_acessos_etapas to service_role;
create policy usuario_acessos_etapas_select on public.usuario_acessos_etapas
for select to authenticated using (
  empresa_id=private.current_empresa_id() and (usuario_id=auth.uid() or private.is_master_atlas())
);
-- Escrita apenas pela API autenticada Master; cliente não pode conceder o próprio acesso.
insert into public.usuario_acessos_etapas(usuario_id,empresa_id,config)
select u.id,u.empresa_id,c.valor::jsonb
from public.usuarios u join public.configuracoes_gerais c on c.chave='acesso_usuario:'||u.id::text
where u.empresa_id is not null
on conflict(usuario_id) do nothing;
-- Impede que integrações antigas contornem a API alterando as chaves legadas.
create policy acesso_usuario_legado_write_guard on public.configuracoes_gerais
as restrictive for all to authenticated
using (chave not like 'acesso_usuario:%' or chave='acesso_usuario:'||auth.uid()::text or private.is_master_atlas())
with check (chave not like 'acesso_usuario:%' or private.is_master_atlas());
-- Gravação atômica pelo backend. Mantém leitores legados e rollback coerentes.
create function public.salvar_acesso_usuario_etapas_backend(
  p_usuario_id uuid, p_empresa_id uuid, p_config jsonb
) returns void language plpgsql security invoker set search_path='' as $$
begin
  if jsonb_typeof(p_config) <> 'object' or not exists(
    select 1 from public.usuarios u where u.id=p_usuario_id and u.empresa_id=p_empresa_id and u.role <> 'master'
  ) then
    raise exception 'Usuário ou configuração inválidos';
  end if;
  insert into public.usuario_acessos_etapas(usuario_id,empresa_id,config,updated_at)
  values(p_usuario_id,p_empresa_id,p_config,now())
  on conflict(usuario_id) do update set empresa_id=excluded.empresa_id,config=excluded.config,updated_at=excluded.updated_at;
  insert into public.configuracoes_gerais(chave,valor,empresa_id,updated_at)
  values('acesso_usuario:'||p_usuario_id::text,p_config::text,p_empresa_id,now())
  on conflict(chave) do update set valor=excluded.valor,empresa_id=excluded.empresa_id,updated_at=excluded.updated_at;
end;
$$;
revoke all on function public.salvar_acesso_usuario_etapas_backend(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.salvar_acesso_usuario_etapas_backend(uuid,uuid,jsonb) to service_role;
commit;
