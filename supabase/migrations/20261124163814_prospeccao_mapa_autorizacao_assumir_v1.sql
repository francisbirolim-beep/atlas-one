create table if not exists public.prospeccao_permissoes_usuarios (
  empresa_id uuid not null default private.current_empresa_id() references public.empresas(id),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  pode_ver_mapa boolean not null default false,
  pode_assumir boolean not null default false,
  autorizado_por uuid references public.usuarios(id),
  atualizado_em timestamptz not null default now(),
  primary key (empresa_id, usuario_id),
  constraint prospeccao_permissoes_assumir_exige_mapa check (not pode_assumir or pode_ver_mapa)
);

alter table public.prospeccao_permissoes_usuarios enable row level security;
revoke all on public.prospeccao_permissoes_usuarios from anon, authenticated;
grant select, insert, update, delete on public.prospeccao_permissoes_usuarios to authenticated;

create policy prospeccao_permissoes_usuarios_select on public.prospeccao_permissoes_usuarios
for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (usuario_id = (select auth.uid()) or (select private.is_master_atlas()))
);

create policy prospeccao_permissoes_usuarios_insert on public.prospeccao_permissoes_usuarios
for insert to authenticated
with check (
  empresa_id = (select private.current_empresa_id())
  and (select private.is_master_atlas())
  and autorizado_por = (select auth.uid())
  and exists (select 1 from public.usuarios u where u.id = usuario_id and u.empresa_id = (select private.current_empresa_id()) and u.role <> 'master')
);

create policy prospeccao_permissoes_usuarios_update on public.prospeccao_permissoes_usuarios
for update to authenticated
using (empresa_id = (select private.current_empresa_id()) and (select private.is_master_atlas()))
with check (
  empresa_id = (select private.current_empresa_id())
  and (select private.is_master_atlas())
  and autorizado_por = (select auth.uid())
  and exists (select 1 from public.usuarios u where u.id = usuario_id and u.empresa_id = (select private.current_empresa_id()) and u.role <> 'master')
);

create policy prospeccao_permissoes_usuarios_delete on public.prospeccao_permissoes_usuarios
for delete to authenticated
using (empresa_id = (select private.current_empresa_id()) and (select private.is_master_atlas()));

drop policy if exists prospeccoes_select on public.prospeccoes;
create policy prospeccoes_select on public.prospeccoes
for select to authenticated using (
  empresa_id = (select private.current_empresa_id()) and (
    responsavel_id = (select auth.uid())
    or (select private.is_master_atlas())
    or exists (
      select 1 from public.prospeccao_permissoes_usuarios a
      where a.empresa_id = prospeccoes.empresa_id
        and a.usuario_id = (select auth.uid())
        and a.pode_ver_mapa
    )
  )
);

drop policy if exists prospeccao_contatos_select on public.prospeccao_contatos;
create policy prospeccao_contatos_select on public.prospeccao_contatos
for select to authenticated using (
  empresa_id = (select private.current_empresa_id())
  and exists (
    select 1 from public.prospeccoes p
    where p.id = prospeccao_id
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas())
        or exists (select 1 from public.prospeccao_permissoes_usuarios a
          where a.empresa_id = p.empresa_id and a.usuario_id = (select auth.uid()) and a.pode_ver_mapa))
  )
);

drop policy if exists prospeccao_interacoes_select on public.prospeccao_interacoes;
create policy prospeccao_interacoes_select on public.prospeccao_interacoes
for select to authenticated using (
  empresa_id = (select private.current_empresa_id())
  and exists (
    select 1 from public.prospeccoes p
    where p.id = prospeccao_id
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas())
        or exists (select 1 from public.prospeccao_permissoes_usuarios a
          where a.empresa_id = p.empresa_id and a.usuario_id = (select auth.uid()) and a.pode_ver_mapa))
  )
);

drop policy if exists prospeccao_fotos_select on public.prospeccao_fotos;
create policy prospeccao_fotos_select on public.prospeccao_fotos
for select to authenticated using (
  empresa_id = (select private.current_empresa_id())
  and exists (
    select 1 from public.prospeccoes p
    where p.id = prospeccao_id
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas())
        or exists (select 1 from public.prospeccao_permissoes_usuarios a
          where a.empresa_id = p.empresa_id and a.usuario_id = (select auth.uid()) and a.pode_ver_mapa))
  )
);

drop policy if exists prospeccao_fotos_storage_select on storage.objects;
create policy prospeccao_fotos_storage_select on storage.objects
for select to authenticated using (
  bucket_id = 'prospeccao-fotos'
  and (storage.foldername(name))[1] = (select private.current_empresa_id())::text
  and exists (
    select 1 from public.prospeccoes p
    where p.id::text = (storage.foldername(name))[2]
      and p.empresa_id = (select private.current_empresa_id())
      and (p.responsavel_id = (select auth.uid()) or (select private.is_master_atlas())
        or exists (select 1 from public.prospeccao_permissoes_usuarios a
          where a.empresa_id = p.empresa_id and a.usuario_id = (select auth.uid()) and a.pode_ver_mapa))
  )
);

create or replace function public.fn_assumir_prospeccao_v1(
  p_prospeccao_id uuid, p_responsavel_esperado uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_empresa uuid := private.current_empresa_id();
  v_nome text;
  v_p public.prospeccoes%rowtype;
  v_permitido boolean;
begin
  if v_uid is null or v_empresa is null then
    raise exception 'Sua sessão expirou.';
  end if;
  select u.nome into v_nome from public.usuarios u
  where u.id = v_uid and u.empresa_id = v_empresa and u.role in ('funcionario', 'master');
  if v_nome is null then raise exception 'Usuário sem acesso à empresa.'; end if;

  select (private.is_master_atlas() or exists (
    select 1 from public.prospeccao_permissoes_usuarios a
    where a.empresa_id = v_empresa and a.usuario_id = v_uid
      and a.pode_ver_mapa and a.pode_assumir
  )) into v_permitido;

  if not v_permitido then raise exception 'Você não tem autorização para assumir prospecções.'; end if;
  select * into v_p from public.prospeccoes
  where id = p_prospeccao_id and empresa_id = v_empresa
  for update;
  if not found then raise exception 'Prospecção não encontrada ou sem acesso.'; end if;
  if v_p.responsavel_id = v_uid then
    return jsonb_build_object('ok',true,'ja_responsavel',true);
  end if;
  if v_p.responsavel_id is distinct from p_responsavel_esperado then
    raise exception 'Esta prospecção mudou de responsável. Atualize a página antes de tentar novamente.';
  end if;
  if v_p.status in ('convertido','sem_interesse') then
    raise exception 'Esta prospecção está encerrada e não pode ser assumida.';
  end if;

  update public.prospeccoes
  set responsavel_id = v_uid, responsavel_nome = v_nome,
      status_atualizado_em = now()
  where id = v_p.id and empresa_id = v_empresa;

  if v_p.agenda_evento_id is not null then
    update public.eventos
    set usuario_id = v_uid
    where id = v_p.agenda_evento_id and empresa_id = v_empresa
      and usuario_id = v_p.responsavel_id;
  end if;

  insert into public.prospeccao_interacoes(
    empresa_id,prospeccao_id,tipo,descricao,
    usuario_id,usuario_nome
  )
  values (
    v_empresa,v_p.id,'outro',
    'Responsável alterado de ' || coalesce(nullif(v_p.responsavel_nome,''),'Não informado') || ' para ' || v_nome || ' (prospecção assumida).',
    v_uid,v_nome
  );

  return jsonb_build_object('ok',true,'responsavel_id',v_uid,'responsavel_nome',v_nome);
end;
$$;

revoke all on function public.fn_assumir_prospeccao_v1(uuid,uuid) from public,anon;
grant execute on function public.fn_assumir_prospeccao_v1(uuid,uuid) to authenticated;
