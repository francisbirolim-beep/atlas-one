-- Sem depender de refresh automatico do JWT: atividade humana deve renovar o prazo.
create table if not exists public.atlas_sessoes_atividade (
  session_id uuid primary key,
  usuario_id uuid not null,
  ultima_atividade timestamptz not null default clock_timestamp(),
  criada_em timestamptz not null default clock_timestamp()
);
create index if not exists atlas_sessoes_atividade_ultima_idx
  on public.atlas_sessoes_atividade(ultima_atividade);
alter table public.atlas_sessoes_atividade enable row level security;
revoke all on public.atlas_sessoes_atividade from public, anon, authenticated;
grant select, insert, update, delete on public.atlas_sessoes_atividade to service_role;

create or replace function public.atlas_iniciar_atividade_sessao(
  p_sessao uuid, p_usuario uuid
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_salvou boolean := false;
begin
  insert into public.atlas_sessoes_atividade as a
    (session_id, usuario_id, ultima_atividade)
  select s.id,s.user_id,clock_timestamp() from auth.sessions s
  where s.id = p_sessao and s.user_id = p_usuario
    and (s.not_after is null or s.not_after > clock_timestamp())
  on conflict (session_id) do update
    set ultima_atividade = excluded.ultima_atividade
    where a.usuario_id = excluded.usuario_id
  returning true into v_salvou;
  return coalesce(v_salvou,false);
end;
$$;
revoke all on function public.atlas_iniciar_atividade_sessao(uuid,uuid) from public, anon, authenticated;
grant execute on function public.atlas_iniciar_atividade_sessao(uuid,uuid) to service_role;

create or replace function public.atlas_registrar_atividade_sessao(
  p_sessao uuid, p_usuario uuid
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_alterou boolean := false;
begin
  update public.atlas_sessoes_atividade as a
  set ultima_atividade = clock_timestamp()
  where a.session_id = p_sessao and a.usuario_id = p_usuario
    and a.ultima_atividade > clock_timestamp() - interval '60 minutes'
    and exists (select 1 from auth.sessions s where s.id=p_sessao and s.user_id=p_usuario
      and (s.not_after is null or s.not_after > clock_timestamp()))
  returning true into v_alterou;
  return coalesce(v_alterou,false);
end;
$$;
revoke all on function public.atlas_registrar_atividade_sessao(uuid,uuid) from public, anon, authenticated;
grant execute on function public.atlas_registrar_atividade_sessao(uuid,uuid) to service_role;

create or replace function public.atlas_sessao_ativa_servidor(
  p_sessao uuid, p_usuario uuid
) returns boolean language sql stable security definer set search_path = ''
as $$
  select p_sessao is not null and p_usuario is not null
    and exists (
      select 1 from auth.sessions s
      join public.atlas_sessoes_atividade a on a.session_id=s.id
      where s.id=p_sessao and s.user_id=p_usuario and a.usuario_id=p_usuario
        and a.ultima_atividade > now() - interval '60 minutes'
        and (s.not_after is null or s.not_after > now())
    );
$$;
revoke all on function public.atlas_sessao_ativa_servidor(uuid,uuid) from public, anon, authenticated;
grant execute on function public.atlas_sessao_ativa_servidor(uuid,uuid) to service_role;