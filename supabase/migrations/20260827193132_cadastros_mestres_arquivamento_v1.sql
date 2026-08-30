create or replace function public.fn_cadastro_mestre_arquivar_em_vez_excluir_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'tipologias' then
    execute format('update public.%I set ativo = false where id = $1', tg_table_name) using old.id;
  else
    execute format('update public.%I set ativo = false, updated_at = now() where id = $1', tg_table_name) using old.id;
  end if;
  return null;
end;
$$;

revoke all on function public.fn_cadastro_mestre_arquivar_em_vez_excluir_v1() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['produtos','fornecedores','linhas','cores','tipologias','linhas_tecnicas'] loop
    execute format('drop trigger if exists trg_%I_arquivar_em_vez_excluir on public.%I', t, t);
    execute format('create trigger trg_%I_arquivar_em_vez_excluir before delete on public.%I for each row execute function public.fn_cadastro_mestre_arquivar_em_vez_excluir_v1()', t, t);
  end loop;
end $$;
