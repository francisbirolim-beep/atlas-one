create or replace function public.fn_venda_estado_atual_v1(p_venda_obra_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_empresa_id uuid;
  v_venda public.vendas_obras%rowtype;
  v_estado jsonb;
  v_revisao jsonb;
begin
  if v_auth_uid is null then raise exception 'Usuário não autenticado'; end if;
  select empresa_id into v_empresa_id from public.usuarios where id=v_auth_uid;
  if v_empresa_id is null then raise exception 'Usuário sem empresa vinculada'; end if;

  select * into v_venda
  from public.vendas_obras
  where id=p_venda_obra_id and empresa_id=v_empresa_id;
  if not found then return null; end if;

  v_estado:=jsonb_build_object(
    'valor_venda',v_venda.valor_venda,
    'custo_previsto',v_venda.custo_previsto,
    'itens_snapshot',coalesce(v_venda.itens_snapshot,'[]'::jsonb),
    'config_snapshot',coalesce(v_venda.config_snapshot,'{}'::jsonb),
    'versao',v_venda.versao
  );

  select r.depois into v_revisao
  from public.venda_obra_revisoes r
  where r.venda_obra_id=p_venda_obra_id and r.empresa_id=v_empresa_id
  order by r.versao desc,r.created_at desc limit 1;

  return coalesce(v_revisao,v_estado);
end;
$$;

create or replace function public.fn_registrar_revisao_venda_v1(
  p_venda_obra_id uuid,
  p_justificativa text,
  p_depois jsonb,
  p_impacto_valor numeric default null,
  p_impacto_custo numeric default null,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_empresa_id uuid;
  v_venda public.vendas_obras%rowtype;
  v_antes jsonb;
  v_depois jsonb;
  v_versao integer;
  v_id uuid;
  v_projeto_conferido boolean;
begin
  if v_auth_uid is null or p_usuario_id is distinct from v_auth_uid then
    raise exception 'Usuário autenticado inválido para revisão de venda';
  end if;
  select empresa_id into v_empresa_id from public.usuarios where id=v_auth_uid;
  if v_empresa_id is null then raise exception 'Usuário sem empresa vinculada'; end if;

  if length(trim(coalesce(p_justificativa,'')))<3 then raise exception 'Justificativa obrigatória para alteração pós-venda'; end if;
  if p_depois is null or jsonb_typeof(p_depois)<>'object' then raise exception 'Estado revisado inválido'; end if;

  select * into v_venda
  from public.vendas_obras
  where id=p_venda_obra_id and empresa_id=v_empresa_id
  for update;
  if not found then raise exception 'Venda não encontrada'; end if;

  v_antes:=public.fn_venda_estado_atual_v1(p_venda_obra_id);
  select coalesce(max(versao),v_venda.versao)+1 into v_versao
  from public.venda_obra_revisoes
  where venda_obra_id=p_venda_obra_id and empresa_id=v_empresa_id;

  v_depois:=p_depois || jsonb_build_object('versao',v_versao);
  insert into public.venda_obra_revisoes(
    empresa_id,venda_obra_id,versao,tipo,justificativa,antes,depois,
    impacto_valor,impacto_custo,criado_por_id,criado_por_nome
  ) values(
    v_empresa_id,p_venda_obra_id,v_versao,'ajuste',p_justificativa,v_antes,v_depois,
    p_impacto_valor,p_impacto_custo,v_auth_uid,p_usuario_nome
  ) returning id into v_id;

  update public.vendas_obras
  set versao=v_versao,updated_at=now()
  where id=p_venda_obra_id and empresa_id=v_empresa_id;

  select exists(
    select 1
    from public.setor_kanban_itens ski
    join public.setor_kanban_colunas c on c.id=ski.coluna_id and c.empresa_id=v_empresa_id
    where ski.orcamento_id=v_venda.orcamento_id
      and ski.empresa_id=v_empresa_id
      and c.setor_id='engenharia-projeto'
      and lower(c.nome)='projeto conferido'
  ) into v_projeto_conferido;

  if v_projeto_conferido then
    perform public.fn_criar_ordens_producao_v1(v_venda.orcamento_id,v_auth_uid,p_usuario_nome);
  end if;
  return v_id;
end;
$$;

revoke execute on function public.fn_venda_estado_atual_v1(uuid) from public,anon;
revoke execute on function public.fn_registrar_revisao_venda_v1(uuid,text,jsonb,numeric,numeric,uuid,text) from public,anon;
grant execute on function public.fn_venda_estado_atual_v1(uuid) to authenticated;
grant execute on function public.fn_registrar_revisao_venda_v1(uuid,text,jsonb,numeric,numeric,uuid,text) to authenticated;
