begin;
create table if not exists public.atlas_auth_limites (chave text primary key, janela_inicio timestamptz not null default now(), tentativas integer not null default 0 check(tentativas>=0), atualizado_em timestamptz not null default now());
alter table public.atlas_auth_limites enable row level security;
revoke all on public.atlas_auth_limites from public, anon, authenticated;
grant select,insert,update,delete on public.atlas_auth_limites to service_role;
create or replace function public.atlas_verificar_limite_auth(p_chave text,p_maximo integer,p_janela_segundos integer)
returns table(permitido boolean,retry_apos integer)
language plpgsql security invoker set search_path = ''
as $$
declare v_inicio timestamptz; v_tentativas integer; v_agora timestamptz := clock_timestamp();
begin
if length(p_chave)<16 or length(p_chave)>180 or p_maximo<1 or p_maximo>1000 or p_janela_segundos<60 or p_janela_segundos>86400 then raise exception 'Parametros invalidos'; end if;
insert into public.atlas_auth_limites(chave,janela_inicio,tentativas,atualizado_em) values(p_chave,v_agora,1,v_agora)
on conflict(chave) do update set
janela_inicio=case when public.atlas_auth_limites.janela_inicio<=v_agora-make_interval(secs=>p_janela_segundos) then v_agora else public.atlas_auth_limites.janela_inicio end,
tentativas=case when public.atlas_auth_limites.janela_inicio<=v_agora-make_interval(secs=>p_janela_segundos) then 1 else public.atlas_auth_limites.tentativas+1 end,
atualizado_em=v_agora
returning janela_inicio,tentativas into v_inicio,v_tentativas;
return query select v_tentativas<=p_maximo, greatest(1,ceil(extract(epoch from (v_inicio+make_interval(secs=>p_janela_segundos)-v_agora)))::integer);
end;
$$;
revoke all on function public.atlas_verificar_limite_auth(text,integer,integer) from public,anon,authenticated;
grant execute on function public.atlas_verificar_limite_auth(text,integer,integer) to service_role;
create index if not exists idx_atlas_auth_limites_atualizado on public.atlas_auth_limites(atualizado_em);
commit;