-- Rate limit compartilhado entre instancias Vercel, sem IP ou nome de usuario em texto claro.
create table if not exists public.atlas_login_limites (
  chave text primary key check (length(chave) = 64),
  inicio_janela timestamptz not null default now(),
  tentativas integer not null default 0 check (tentativas >= 0)
);
alter table public.atlas_login_limites enable row level security;
revoke all on public.atlas_login_limites from public, anon, authenticated;
grant select, insert, update, delete on public.atlas_login_limites to service_role;
create index if not exists atlas_login_limites_inicio_idx on public.atlas_login_limites (inicio_janela);

create or replace function public.atlas_consumir_limite_login(
  p_chave text, p_maximo integer, p_janela_segundos integer
)
returns table(permitido boolean, aguardar_segundos integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz;
  v_contagem integer;
  v_agora timestamptz := clock_timestamp();
begin
  if p_chave !~ '^[a-f0-9]{64}$'
     or p_maximo not between 1 and 100
     or p_janela_segundos not between 60 and 86400 then
    raise exception 'Argumentos de limite invalidos' using errcode = '22023';
  end if;
  insert into public.atlas_login_limites as a (chave, inicio_janela, tentativas)
  values (p_chave, v_agora, 1)
  on conflict (chave) do update
  set inicio_janela = case
       when a.inicio_janela <= v_agora - make_interval(secs => p_janela_segundos)
       then v_agora else a.inicio_janela end,
      tentativas = case
       when a.inicio_janela <= v_agora - make_interval(secs => p_janela_segundos)
       then 1 else a.tentativas + 1 end
  returning a.inicio_janela, a.tentativas
  into v_inicio, v_contagem;
  permitido := v_contagem <= p_maximo;
  aguardar_segundos := greatest(1, ceil(extract(epoch from
      (v_inicio + make_interval(secs => p_janela_segundos) - v_agora)))::integer);
  return next;
end;
$$;
revoke all on function public.atlas_consumir_limite_login(text,integer,integer) from public, anon, authenticated;
grant execute on function public.atlas_consumir_limite_login(text,integer,integer) to service_role;