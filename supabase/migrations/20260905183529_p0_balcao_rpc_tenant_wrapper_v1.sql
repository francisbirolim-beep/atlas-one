alter function public.finalizar_venda_balcao(uuid,uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean)
  rename to finalizar_venda_balcao_impl;

revoke all on function public.finalizar_venda_balcao_impl(uuid,uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) from public, anon, authenticated;
grant execute on function public.finalizar_venda_balcao_impl(uuid,uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) to service_role;

create or replace function public.finalizar_venda_balcao(
  p_caixa_id uuid,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_usuario_role text,
  p_cliente_id uuid,
  p_cliente_nome text,
  p_itens jsonb,
  p_pagamentos jsonb,
  p_desconto numeric default 0,
  p_observacoes text default null,
  p_permitir_abaixo_minimo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario record;
  v_caixa record;
  v_empresa_id uuid;
  v_item jsonb;
  v_produto_id uuid;
  v_local_id uuid;
  v_pode_vender boolean := false;
  v_pode_desconto boolean := false;
begin
  select id,nome,role,empresa_id into v_usuario from public.usuarios where id=p_usuario_id;
  if v_usuario.id is null or v_usuario.empresa_id is null then raise exception 'Usuário inválido ou sem empresa vinculada.'; end if;
  v_empresa_id := v_usuario.empresa_id;

  v_pode_vender := v_usuario.role='master' or exists(
    select 1 from public.permissoes p
    where p.usuario_id=v_usuario.id and p.empresa_id=v_empresa_id and p.setor_id='venda-balcao' and p.nivel='edicao'
  );
  if not v_pode_vender then raise exception 'Usuário sem permissão de edição na Venda Balcão.'; end if;

  select id,status,operador_id,ponto_caixa_id,unidade_id,local_estoque_id,empresa_id into v_caixa
  from public.balcao_caixas where id=p_caixa_id and empresa_id=v_empresa_id;
  if v_caixa.id is null then raise exception 'Caixa pertence a outra empresa ou não existe.'; end if;
  if v_caixa.status<>'aberto' then raise exception 'Caixa não está aberto.'; end if;
  if v_caixa.local_estoque_id is null or v_caixa.unidade_id is null or v_caixa.ponto_caixa_id is null then raise exception 'Caixa sem unidade/local configurado.'; end if;
  if v_usuario.role<>'master' and v_caixa.operador_id<>v_usuario.id then raise exception 'Este caixa foi aberto por outro operador.'; end if;

  if not exists(select 1 from public.unidades_operacionais u where u.id=v_caixa.unidade_id and u.empresa_id=v_empresa_id) then raise exception 'Unidade do caixa pertence a outra empresa.'; end if;
  if not exists(select 1 from public.estoque_locais l where l.id=v_caixa.local_estoque_id and l.empresa_id=v_empresa_id) then raise exception 'Local de estoque do caixa pertence a outra empresa.'; end if;
  if p_cliente_id is not null and not exists(select 1 from public.clientes c where c.id=p_cliente_id and c.empresa_id=v_empresa_id) then raise exception 'Cliente pertence a outra empresa.'; end if;

  if jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then raise exception 'Venda sem itens.'; end if;
  for v_item in select * from jsonb_array_elements(p_itens) loop
    begin
      v_produto_id := nullif(v_item->>'produtoId','')::uuid;
      v_local_id := coalesce(nullif(v_item->>'localOrigemId','')::uuid,v_caixa.local_estoque_id);
    exception when invalid_text_representation then
      raise exception 'Produto ou local de estoque inválido.';
    end;
    if v_produto_id is null or not exists(select 1 from public.produtos p where p.id=v_produto_id and p.empresa_id=v_empresa_id and p.ativo=true) then raise exception 'Produto pertence a outra empresa, não existe ou está inativo.'; end if;
    if v_local_id is null or not exists(select 1 from public.estoque_locais l where l.id=v_local_id and l.empresa_id=v_empresa_id and l.ativo=true) then raise exception 'Local de estoque pertence a outra empresa ou está inativo.'; end if;
  end loop;

  if p_permitir_abaixo_minimo then
    v_pode_desconto := v_usuario.role='master' or exists(
      select 1 from public.permissoes p
      where p.usuario_id=v_usuario.id and p.empresa_id=v_empresa_id and p.setor_id='relatorios-balcao' and p.nivel='edicao'
    );
    if not v_pode_desconto then raise exception 'Usuário sem permissão para venda abaixo do preço mínimo.'; end if;
  end if;

  return public.finalizar_venda_balcao_impl(
    p_caixa_id,v_usuario.id,v_usuario.nome,v_usuario.role,p_cliente_id,p_cliente_nome,p_itens,p_pagamentos,p_desconto,p_observacoes,p_permitir_abaixo_minimo
  );
end;
$$;

revoke all on function public.finalizar_venda_balcao(uuid,uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) from public, anon, authenticated;
grant execute on function public.finalizar_venda_balcao(uuid,uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) to service_role;