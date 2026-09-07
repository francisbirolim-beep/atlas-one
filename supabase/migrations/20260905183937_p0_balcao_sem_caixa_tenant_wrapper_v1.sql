alter function public.finalizar_venda_balcao_sem_caixa(uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean)
  rename to finalizar_venda_balcao_sem_caixa_impl;

revoke all on function public.finalizar_venda_balcao_sem_caixa_impl(uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) from public, anon, authenticated;
grant execute on function public.finalizar_venda_balcao_sem_caixa_impl(uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) to service_role;

create or replace function public.finalizar_venda_balcao_sem_caixa(
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
set search_path=''
as $$
declare
  v_usuario record;
  v_empresa_id uuid;
  v_item jsonb;
  v_itens_normalizados jsonb:='[]'::jsonb;
  v_produto_id uuid;
  v_local_id uuid;
  v_local_padrao_id uuid;
  v_pode_vender boolean:=false;
  v_pode_desconto boolean:=false;
begin
  select id,nome,role,empresa_id into v_usuario from public.usuarios where id=p_usuario_id;
  if v_usuario.id is null or v_usuario.empresa_id is null then raise exception 'Usuário inválido ou sem empresa vinculada.'; end if;
  v_empresa_id:=v_usuario.empresa_id;

  v_pode_vender:=v_usuario.role='master' or exists(
    select 1 from public.permissoes p
    where p.usuario_id=v_usuario.id and p.empresa_id=v_empresa_id and p.setor_id='venda-balcao' and p.nivel='edicao'
  );
  if not v_pode_vender then raise exception 'Usuário sem permissão de edição na Venda Balcão.'; end if;

  if p_cliente_id is not null and not exists(select 1 from public.clientes c where c.id=p_cliente_id and c.empresa_id=v_empresa_id) then
    raise exception 'Cliente pertence a outra empresa.';
  end if;

  if jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0 then raise exception 'Venda sem itens.'; end if;

  select l.id into v_local_padrao_id
  from public.estoque_locais l
  join public.unidades_operacionais u on u.id=l.unidade_id and u.empresa_id=v_empresa_id
  where l.empresa_id=v_empresa_id and l.ativo=true and l.permite_venda=true
  order by case when u.codigo='MATRIZ' and l.codigo='GERAL' then 0 else 1 end,l.created_at
  limit 1;
  if v_local_padrao_id is null then raise exception 'Nenhum local de estoque disponível para a empresa.'; end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    begin
      v_produto_id:=nullif(v_item->>'produtoId','')::uuid;
      v_local_id:=coalesce(nullif(v_item->>'localOrigemId','')::uuid,v_local_padrao_id);
    exception when invalid_text_representation then
      raise exception 'Produto ou local de estoque inválido.';
    end;
    if v_produto_id is null or not exists(select 1 from public.produtos p where p.id=v_produto_id and p.empresa_id=v_empresa_id and p.ativo=true) then
      raise exception 'Produto pertence a outra empresa, não existe ou está inativo.';
    end if;
    if v_local_id is null or not exists(select 1 from public.estoque_locais l where l.id=v_local_id and l.empresa_id=v_empresa_id and l.ativo=true and l.permite_venda=true) then
      raise exception 'Local de estoque pertence a outra empresa ou está indisponível.';
    end if;
    v_itens_normalizados:=v_itens_normalizados||jsonb_build_array(jsonb_set(v_item,'{localOrigemId}',to_jsonb(v_local_id::text),true));
  end loop;

  if p_permitir_abaixo_minimo then
    v_pode_desconto:=v_usuario.role='master' or exists(
      select 1 from public.permissoes p
      where p.usuario_id=v_usuario.id and p.empresa_id=v_empresa_id and p.setor_id='relatorios-balcao' and p.nivel='edicao'
    );
    if not v_pode_desconto then raise exception 'Usuário sem permissão para venda abaixo do preço mínimo.'; end if;
  end if;

  return public.finalizar_venda_balcao_sem_caixa_impl(
    v_usuario.id,v_usuario.nome,v_usuario.role,p_cliente_id,p_cliente_nome,v_itens_normalizados,p_pagamentos,p_desconto,p_observacoes,p_permitir_abaixo_minimo
  );
end;
$$;

revoke all on function public.finalizar_venda_balcao_sem_caixa(uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) from public, anon, authenticated;
grant execute on function public.finalizar_venda_balcao_sem_caixa(uuid,text,text,uuid,text,jsonb,jsonb,numeric,text,boolean) to service_role;