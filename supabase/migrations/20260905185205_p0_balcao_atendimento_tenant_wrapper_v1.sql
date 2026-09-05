alter function public.avancar_atendimento_venda_balcao(uuid,text,uuid,text,text) rename to avancar_atendimento_venda_balcao_impl;

create or replace function public.avancar_atendimento_venda_balcao(
  p_item_id uuid,
  p_acao text,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_observacoes text default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_empresa uuid;
  v_nome text;
  v_role text;
  v_item record;
begin
  select u.empresa_id,u.nome,u.role into v_empresa,v_nome,v_role
  from public.usuarios u where u.id=p_usuario_id;
  if v_empresa is null then raise exception 'Usuário sem empresa válida'; end if;
  if not (v_role='master' or private.usuario_pode_editar_setor(p_usuario_id,v_empresa,'venda-balcao')) then
    raise exception 'Usuário sem permissão de edição em Venda Balcão';
  end if;

  select i.id,i.venda_id into v_item
  from public.balcao_venda_itens i
  join public.balcao_vendas v on v.id=i.venda_id and v.empresa_id=v_empresa
  where i.id=p_item_id and i.empresa_id=v_empresa;
  if v_item.id is null then raise exception 'Item de atendimento não encontrado para esta empresa'; end if;

  return public.avancar_atendimento_venda_balcao_impl(
    p_item_id,p_acao,p_usuario_id,v_nome,p_observacoes
  );
end;
$$;

revoke all on function public.avancar_atendimento_venda_balcao(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.avancar_atendimento_venda_balcao(uuid,text,uuid,text,text) to service_role;
revoke all on function public.avancar_atendimento_venda_balcao_impl(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.avancar_atendimento_venda_balcao_impl(uuid,text,uuid,text,text) to service_role;
