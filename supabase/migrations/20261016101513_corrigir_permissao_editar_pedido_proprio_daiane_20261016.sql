begin;
create table if not exists private.atlas_compras_daiane_permissoes_snapshot_20261016(
 usuario_id uuid primary key, empresa_id uuid not null,
 config_anterior jsonb, tinha_config boolean not null,
 salvo_em timestamptz not null default now());
revoke all on private.atlas_compras_daiane_permissoes_snapshot_20261016 from public,anon,authenticated;
insert into private.atlas_compras_daiane_permissoes_snapshot_20261016(usuario_id,empresa_id,config_anterior,tinha_config)
 select u.id,u.empresa_id,a.config,(a.usuario_id is not null)
 from public.usuarios u
 left join public.usuario_acessos_etapas a on a.usuario_id=u.id and a.empresa_id=u.empresa_id
 where u.id='8e8153b2-044b-4002-8c27-63bc6a03690f'::uuid and upper(u.nome)='DAIANE'
 on conflict(usuario_id) do nothing;
insert into public.usuario_acessos_etapas(usuario_id,empresa_id,config)
 select u.id,u.empresa_id,jsonb_build_object('acoes',jsonb_build_object('compras.geral.editar_proprios','edicao'),'crmEscopo','proprios')
 from public.usuarios u
 join public.permissoes p on p.usuario_id=u.id and p.empresa_id=u.empresa_id and p.setor_id='compras' and p.nivel='edicao'
 where u.id='8e8153b2-044b-4002-8c27-63bc6a03690f'::uuid and upper(u.nome)='DAIANE'
 on conflict(usuario_id) do update set
 config=jsonb_set(
  coalesce(public.usuario_acessos_etapas.config,'{}'::jsonb),
  '{acoes,compras.geral.editar_proprios}','"edicao"'::jsonb,true),
 updated_at=now()
 where public.usuario_acessos_etapas.empresa_id=excluded.empresa_id;
commit;