-- Comunicação por usuário, isolamento por empresa e auditoria do chat interno.

alter table public.chat_conversas
  add column if not exists empresa_id uuid references public.empresas(id) on delete cascade;

update public.chat_conversas c
set empresa_id = u.empresa_id
from public.usuarios u
where c.empresa_id is null
  and u.id = c.criado_por_id;

alter table public.chat_conversas
  alter column empresa_id set not null;

create index if not exists chat_conversas_empresa_updated_idx
  on public.chat_conversas (empresa_id, updated_at desc);

create table if not exists public.usuario_comunicacao_permissoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  chat_interno boolean not null default true,
  chat_interno_todos boolean not null default true,
  whatsapp_externo boolean not null default false,
  whatsapp_iniciar_externo boolean not null default false,
  whatsapp_cadastrar_contato boolean not null default false,
  ia_ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, usuario_id)
);

create index if not exists usuario_comunicacao_permissoes_usuario_idx
  on public.usuario_comunicacao_permissoes (usuario_id);

create table if not exists public.usuario_chat_destinos_permitidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  destino_usuario_id uuid not null references public.usuarios(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (empresa_id, usuario_id, destino_usuario_id),
  check (usuario_id <> destino_usuario_id)
);

create index if not exists usuario_chat_destinos_usuario_idx
  on public.usuario_chat_destinos_permitidos (empresa_id, usuario_id);

insert into public.usuario_comunicacao_permissoes (
  empresa_id,
  usuario_id,
  chat_interno,
  chat_interno_todos,
  whatsapp_externo,
  whatsapp_iniciar_externo,
  whatsapp_cadastrar_contato,
  ia_ativa
)
select
  u.empresa_id,
  u.id,
  true,
  true,
  case
    when u.role = 'master' then true
    else exists (
      select 1
      from public.atendimento_whatsapp_permissoes p
      where p.empresa_id = u.empresa_id
        and p.usuario_id = u.id
        and (
          p.pode_visualizar
          or p.pode_atender
          or p.pode_transferir
          or p.pode_supervisionar
        )
    )
  end,
  case
    when u.role = 'master' then true
    else exists (
      select 1
      from public.atendimento_whatsapp_permissoes p
      where p.empresa_id = u.empresa_id
        and p.usuario_id = u.id
        and p.pode_atender
    )
  end,
  false,
  true
from public.usuarios u
on conflict (empresa_id, usuario_id) do nothing;

alter table public.usuario_comunicacao_permissoes enable row level security;
alter table public.usuario_chat_destinos_permitidos enable row level security;

revoke all on public.usuario_comunicacao_permissoes from anon, authenticated;
grant select on public.usuario_comunicacao_permissoes to authenticated;

revoke all on public.usuario_chat_destinos_permitidos from anon, authenticated;
grant select on public.usuario_chat_destinos_permitidos to authenticated;

drop policy if exists usuario_comunicacao_select_v1
  on public.usuario_comunicacao_permissoes;
create policy usuario_comunicacao_select_v1
on public.usuario_comunicacao_permissoes
for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (
    usuario_id = (select auth.uid())
    or (select private.is_master_atlas())
  )
);

drop policy if exists usuario_chat_destinos_select_v1
  on public.usuario_chat_destinos_permitidos;
create policy usuario_chat_destinos_select_v1
on public.usuario_chat_destinos_permitidos
for select to authenticated
using (
  empresa_id = (select private.current_empresa_id())
  and (
    usuario_id = (select auth.uid())
    or (select private.is_master_atlas())
  )
);

revoke delete on public.chat_conversas, public.chat_mensagens from authenticated;

drop policy if exists chat_conversas_delete on public.chat_conversas;

drop policy if exists chat_conversas_select on public.chat_conversas;
create policy chat_conversas_select
on public.chat_conversas
for select to authenticated
using (
  public.atlas_chat_participa(id)
  or (
    (select private.is_master_atlas())
    and empresa_id = (select private.current_empresa_id())
  )
);

drop policy if exists chat_participantes_select on public.chat_participantes;
create policy chat_participantes_select
on public.chat_participantes
for select to authenticated
using (
  public.atlas_chat_participa(conversa_id)
  or (
    (select private.is_master_atlas())
    and exists (
      select 1
      from public.chat_conversas c
      where c.id = conversa_id
        and c.empresa_id = (select private.current_empresa_id())
    )
  )
);

drop policy if exists chat_mensagens_select on public.chat_mensagens;
create policy chat_mensagens_select
on public.chat_mensagens
for select to authenticated
using (
  public.atlas_chat_participa(conversa_id)
  or (
    (select private.is_master_atlas())
    and exists (
      select 1
      from public.chat_conversas c
      where c.id = conversa_id
        and c.empresa_id = (select private.current_empresa_id())
    )
  )
);

drop policy if exists "chat_anexos_delete" on storage.objects;

create or replace function public.atlas_chat_criar_conversa(
  p_nome text,
  p_tipo text,
  p_participantes uuid[]
)
returns public.chat_conversas
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_nome text;
  v_empresa uuid;
  v_role text;
  v_chat_interno boolean := true;
  v_chat_todos boolean := true;
  v_outros uuid[];
  v_conv public.chat_conversas;
  v_id uuid;
  v_bloqueados integer := 0;
begin
  if v_uid is null then
    raise exception 'Sessao nao autenticada';
  end if;

  select u.nome, u.empresa_id, u.role
    into v_nome, v_empresa, v_role
  from public.usuarios u
  where u.id = v_uid;

  if v_empresa is null then
    raise exception 'Usuario sem empresa vinculada';
  end if;

  if v_role <> 'master' then
    select
      coalesce(p.chat_interno, true),
      coalesce(p.chat_interno_todos, true)
      into v_chat_interno, v_chat_todos
    from public.usuario_comunicacao_permissoes p
    where p.empresa_id = v_empresa
      and p.usuario_id = v_uid;

    v_chat_interno := coalesce(v_chat_interno, true);
    v_chat_todos := coalesce(v_chat_todos, true);

    if not v_chat_interno then
      raise exception 'Chat interno nao liberado para este usuario';
    end if;
  end if;

  select coalesce(array_agg(distinct u.id order by u.id), '{}'::uuid[])
    into v_outros
  from public.usuarios u
  where u.id = any(coalesce(p_participantes, '{}'::uuid[]))
    and u.id <> v_uid
    and u.empresa_id = v_empresa;

  if not v_chat_todos and v_role <> 'master' then
    select count(*)
      into v_bloqueados
    from unnest(v_outros) as alvo(id)
    where not exists (
      select 1
      from public.usuario_chat_destinos_permitidos p
      where p.empresa_id = v_empresa
        and p.usuario_id = v_uid
        and p.destino_usuario_id = alvo.id
    );

    if v_bloqueados > 0 then
      raise exception 'Destino interno nao permitido para este usuario';
    end if;
  end if;

  if p_tipo = 'direta' then
    if cardinality(v_outros) <> 1 then
      raise exception 'Conversa direta exige um participante';
    end if;

    select c.id
      into v_id
    from public.chat_conversas c
    where c.tipo = 'direta'
      and c.empresa_id = v_empresa
      and exists (
        select 1
        from public.chat_participantes p
        where p.conversa_id = c.id
          and p.usuario_id = v_uid
      )
      and exists (
        select 1
        from public.chat_participantes p
        where p.conversa_id = c.id
          and p.usuario_id = v_outros[1]
      )
      and (
        select count(*)
        from public.chat_participantes p
        where p.conversa_id = c.id
      ) = 2
    order by c.updated_at desc
    limit 1;

    if v_id is not null then
      select * into v_conv
      from public.chat_conversas
      where id = v_id;
      return v_conv;
    end if;
  elsif p_tipo = 'grupo' then
    if cardinality(v_outros) < 2 then
      raise exception 'Grupo exige ao menos dois participantes';
    end if;
  else
    raise exception 'Tipo de conversa invalido';
  end if;

  insert into public.chat_conversas (
    empresa_id,
    nome,
    tipo,
    criado_por_id,
    criado_por_nome
  )
  values (
    v_empresa,
    nullif(trim(p_nome), ''),
    p_tipo,
    v_uid,
    coalesce(v_nome, 'Usuario')
  )
  returning * into v_conv;

  insert into public.chat_participantes (
    conversa_id,
    usuario_id,
    usuario_nome
  )
  values (
    v_conv.id,
    v_uid,
    coalesce(v_nome, 'Usuario')
  );

  insert into public.chat_participantes (
    conversa_id,
    usuario_id,
    usuario_nome
  )
  select
    v_conv.id,
    u.id,
    u.nome
  from public.usuarios u
  where u.id = any(v_outros)
    and u.empresa_id = v_empresa
  on conflict (conversa_id, usuario_id) do nothing;

  return v_conv;
end
$$;

revoke all on function public.atlas_chat_criar_conversa(text, text, uuid[]) from public, anon;
grant execute on function public.atlas_chat_criar_conversa(text, text, uuid[]) to authenticated;

comment on table public.usuario_comunicacao_permissoes is
  'Permissoes globais de comunicacao e IA por usuario. Acesso externo do WhatsApp continua refinado por canal.';

comment on table public.usuario_chat_destinos_permitidos is
  'Destinos internos liberados quando chat_interno_todos=false.';
