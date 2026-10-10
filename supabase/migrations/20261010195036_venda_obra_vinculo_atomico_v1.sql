-- Associação explícita Venda <-> Obra, transacional e sem associações inferidas.
-- Chamável apenas com service_role no backend autenticado, empresa e cliente conferidos.
create or replace function public.fn_vincular_venda_obra_segura_v1(
  p_empresa_id uuid,
  p_venda_id uuid,
  p_obra_id uuid default null,
  p_nome_nova_obra text default null,
  p_cidade text default null,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_venda public.vendas_obras%rowtype;
  v_orc public.orcamentos%rowtype;
  v_obra public.obras%rowtype;
  v_id uuid;
begin
  if p_empresa_id is null or p_venda_id is null then
    raise exception 'Informe venda e empresa válidas.';
  end if;
  if (p_obra_id is null) = (nullif(btrim(coalesce(p_nome_nova_obra,'')),'') is null) then
    raise exception 'Selecione uma obra existente OU informe o nome de uma nova obra.';
  end if;
  select * into v_venda
    from public.vendas_obras where id=p_venda_id and empresa_id=p_empresa_id for update;
  if not found then raise exception 'Venda não encontrada nesta empresa.'; end if;
  if lower(coalesce(v_venda.status,'')) in ('cancelada','cancelado') then
    raise exception 'Não é possível vincular uma venda cancelada.';
  end if;
  select * into v_orc
    from public.orcamentos
   where id=v_venda.orcamento_id and empresa_id=p_empresa_id for update;
  if not found or v_orc.cliente_id is distinct from v_venda.cliente_id then
    raise exception 'Orçamento e venda não pertencem ao mesmo cliente.';
  end if;
  if p_obra_id is not null then
    select * into v_obra
      from public.obras where id=p_obra_id and empresa_id=p_empresa_id for update;
    if not found or v_obra.cliente_id is distinct from v_venda.cliente_id then
      raise exception 'A obra selecionada não pertence ao cliente desta venda.';
    end if;
    v_id:=v_obra.id;
  else
    if length(btrim(p_nome_nova_obra))<3 or length(btrim(p_nome_nova_obra))>150 then
      raise exception 'Nome da obra deve conter entre 3 e 150 caracteres.';
    end if;
    if exists(
      select 1 from public.obras b where b.empresa_id=p_empresa_id
      and b.cliente_id=v_venda.cliente_id
      and lower(btrim(b.nome))=lower(btrim(p_nome_nova_obra))
    ) then
      raise exception 'Já existe obra com este nome para o cliente. Selecione a obra existente.';
    end if;
    insert into public.obras(
      empresa_id,cliente_id,nome,status,cidade,criado_por_id,criado_por_nome
    ) values (
      p_empresa_id,v_venda.cliente_id,btrim(p_nome_nova_obra),
      'planejamento',nullif(btrim(coalesce(p_cidade,'')),''),
      p_usuario_id,coalesce(nullif(btrim(coalesce(p_usuario_nome,'')),''),'Atlas One')
    ) returning id into v_id;
  end if;

  if v_venda.obra_id is not null and v_venda.obra_id<>v_id then
    raise exception 'A venda já pertence a outra obra. Não será alterada automaticamente.';
  end if;
  if v_orc.obra_id is not null and v_orc.obra_id<>v_id then
    raise exception 'O orçamento já pertence a outra obra. Revise antes de vincular.';
  end if;

  -- Não reatribuir registros que já apontam para outra obra.
  if exists(
    select 1 from public.financeiro_contas_receber f where f.empresa_id=p_empresa_id
    and f.venda_obra_id=p_venda_id and f.obra_id is not null and f.obra_id<>v_id
  ) or exists(
    select 1 from public.setor_kanban_itens k where k.empresa_id=p_empresa_id
    and k.orcamento_id=v_venda.orcamento_id and k.obra_id is not null and k.obra_id<>v_id
  ) or exists(
    select 1 from public.medicoes_finais m where m.empresa_id=p_empresa_id
    and m.orcamento_id=v_venda.orcamento_id and m.obra_id is not null and m.obra_id<>v_id
  ) or exists(
    select 1 from public.ordens_producao op where op.empresa_id=p_empresa_id
    and op.venda_obra_id=p_venda_id and op.obra_id is not null and op.obra_id<>v_id
  ) then
    raise exception 'Já existe registro financeiro, medição, card ou OP associado a outra obra. Confira os dados.';
  end if;

  update public.vendas_obras
     set obra_id=v_id,updated_at=now()
   where id=p_venda_id and empresa_id=p_empresa_id and obra_id is null;

  update public.orcamentos
     set obra_id=v_id,updated_at=now()
   where id=v_venda.orcamento_id and empresa_id=p_empresa_id and obra_id is null;

  update public.financeiro_contas_receber
     set obra_id=v_id
   where empresa_id=p_empresa_id and venda_obra_id=p_venda_id and obra_id is null;
  update public.setor_kanban_itens
     set obra_id=v_id
   where empresa_id=p_empresa_id and orcamento_id=v_venda.orcamento_id and obra_id is null;
  update public.medicoes_finais
     set obra_id=v_id
   where empresa_id=p_empresa_id and orcamento_id=v_venda.orcamento_id and obra_id is null;
  update public.ordens_producao
     set obra_id=v_id
   where empresa_id=p_empresa_id and venda_obra_id=p_venda_id and obra_id is null;
  update public.venda_instalacao_itens
     set obra_id=v_id
   where empresa_id=p_empresa_id and venda_obra_id=p_venda_id and obra_id is null;

  return v_id;
end;
$$;

revoke execute on function public.fn_vincular_venda_obra_segura_v1(uuid,uuid,uuid,text,text,uuid,text)
from public,anon,authenticated;
grant execute on function public.fn_vincular_venda_obra_segura_v1(uuid,uuid,uuid,text,text,uuid,text)
to service_role;
