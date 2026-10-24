-- CANDIDATO: NAO APLICAR EM PRODUCAO. Homologar com schema completo e usuarios ficticios.
-- Fora de supabase/migrations de proposito: nao entra em db push.
-- Escritores operacionais encontrados: /api/criar-usuario e /api/atualizar-usuario
-- usam supabaseAdmin apos autenticar Master e limitar empresa. Login/redefinicao
-- usam SELECT de usuarios / Supabase Auth; nao exigem escrita direta no perfil.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                 where n.nspname='public' and c.relname='usuarios' and c.relrowsecurity) then
    raise exception 'usuarios precisa de RLS habilitada antes deste candidato';
  end if;
  if not has_table_privilege('service_role', 'public.usuarios', 'INSERT')
     or not has_table_privilege('service_role', 'public.usuarios', 'UPDATE') then
    raise exception 'Backend sem privilegios esperados; interromper para revisar';
  end if;
end $$;

-- Revogacao de tabela nao remove grants por coluna. Tratar ambos para impedir
-- autoelevacao tambem quando uma permissao antiga foi concedida por coluna.
revoke all privileges on table public.usuarios from public, anon, authenticated;
do $$
declare col record;
begin
  for col in select attname from pg_attribute
             where attrelid='public.usuarios'::regclass and attnum>0 and not attisdropped
  loop
    execute format('revoke all privileges (%I) on table public.usuarios from public, anon, authenticated', col.attname);
  end loop;
end $$;

-- Leitura existente segue limitada pela policy usuarios_select_empresa.
grant select on table public.usuarios to authenticated;
drop policy if exists usuarios_insert_empresa on public.usuarios;
drop policy if exists usuarios_update_empresa on public.usuarios;
drop policy if exists usuarios_delete_empresa on public.usuarios;
commit;
