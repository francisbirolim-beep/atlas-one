do $$
declare
  v_def text;
  v_alvo constant text := '  return public.finalizar_venda_balcao_impl(';
  v_injecao constant text := '  perform set_config(''request.jwt.claim.sub'', v_usuario.id::text, true);' || E'\n\n' || v_alvo;
begin
  select pg_get_functiondef(p.oid)
    into v_def
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname='finalizar_venda_balcao'
     and pg_get_function_identity_arguments(p.oid) = 'p_caixa_id uuid, p_usuario_id uuid, p_usuario_nome text, p_usuario_role text, p_cliente_id uuid, p_cliente_nome text, p_itens jsonb, p_pagamentos jsonb, p_desconto numeric, p_observacoes text, p_permitir_abaixo_minimo boolean';

  if v_def is null then
    raise exception 'P0 Balcao: wrapper finalizar_venda_balcao nao encontrado';
  end if;
  if position('set_config(''request.jwt.claim.sub''' in v_def) > 0 then
    return;
  end if;
  if position(v_alvo in v_def) = 0 then
    raise exception 'P0 Balcao: ponto de injecao do contexto tenant nao encontrado';
  end if;

  v_def := replace(v_def, v_alvo, v_injecao);
  execute v_def;
end $$;

revoke execute on function public.finalizar_venda_balcao(uuid,uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) from public, anon, authenticated;
grant execute on function public.finalizar_venda_balcao(uuid,uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) to service_role;
