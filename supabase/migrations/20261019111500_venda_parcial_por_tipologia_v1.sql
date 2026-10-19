-- Venda parcial aditiva: preserva o orçamento original e reutiliza o fluxo de venda homologado.
-- NÃO executar automaticamente antes de reconciliar o histórico de migrações.
alter table public.orcamentos
  add column if not exists origem_venda_parcial_id uuid references public.orcamentos(id);

create index if not exists idx_orcamentos_venda_parcial_origem
  on public.orcamentos (empresa_id, origem_venda_parcial_id)
  where origem_venda_parcial_id is not null;

create or replace function public.fn_iniciar_fluxo_venda_parcial_v1(
  p_orcamento_id uuid,
  p_itens jsonb,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
)
returns table(venda_id uuid, projeto_card_id uuid, conta_id uuid, orcamento_vendido_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_empresa_id uuid;
  v_orc public.orcamentos%rowtype;
  v_entrada jsonb;
  v_item jsonb;
  v_itens_vendidos jsonb := '[]'::jsonb;
  v_indices integer[] := '{}';
  v_indice integer;
  v_preco numeric;
  v_valor_total numeric := 0;
  v_custo_total numeric := 0;
  v_custo_incompleto boolean := false;
  v_custo_item text;
  v_vendido_antes boolean;
  v_novo_id uuid;
  v_venda_id uuid;
  v_projeto_id uuid;
  v_conta_id uuid;
begin
  if v_auth_uid is null or p_usuario_id is distinct from v_auth_uid then
    raise exception 'Usuário autenticado inválido para confirmar venda parcial';
  end if;
  select u.empresa_id into v_empresa_id from public.usuarios u where u.id = v_auth_uid;
  if v_empresa_id is null or not private.usuario_pode_editar_setor(v_auth_uid,v_empresa_id,'orcamentos') then
    raise exception 'Sem permissão para confirmar venda parcial';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_orcamento_id::text));
  select * into v_orc from public.orcamentos
  where id = p_orcamento_id and empresa_id = v_empresa_id for update;
  if not found then raise exception 'Orçamento não encontrado'; end if;
  if v_orc.origem_venda_parcial_id is not null then raise exception 'Selecione o orçamento original'; end if;
  if v_orc.cliente_id is null then raise exception 'O cliente precisa estar vinculado'; end if;
  if coalesce(v_orc.modo_entrada,'') = 'balcao' then raise exception 'Venda Balcão segue o fluxo próprio'; end if;
  if exists (select 1 from public.vendas_obras vo where vo.orcamento_id=v_orc.id and vo.empresa_id=v_empresa_id) then
    raise exception 'O orçamento inteiro já foi vendido';
  end if;
  if jsonb_typeof(p_itens) is distinct from 'array'
     or jsonb_array_length(p_itens) < 1
     or jsonb_typeof(coalesce(v_orc.itens,'[]'::jsonb)) <> 'array'
     or jsonb_array_length(p_itens) >= jsonb_array_length(v_orc.itens) then
    raise exception 'Selecione pelo menos um item, mas não todos. Para todos, use Venda total';
  end if;

  for v_entrada in select value from jsonb_array_elements(p_itens) loop
    if jsonb_typeof(v_entrada) <> 'object'
      or (v_entrada->>'indice') !~ '^[0-9]+$'
      or (v_entrada->>'valor') !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'Item/valor da venda parcial inválido';
    end if;
    v_indice := (v_entrada->>'indice')::integer;
    v_preco := (v_entrada->>'valor')::numeric;
    if v_indice >= jsonb_array_length(v_orc.itens) or v_indice = any(v_indices) or v_preco < 0 then
      raise exception 'Item duplicado ou inexistente na venda parcial';
    end if;
    v_item := v_orc.itens->v_indice;
    select exists (
      select 1 from public.orcamentos derivado
      cross join lateral jsonb_array_elements(coalesce(derivado.itens,'[]'::jsonb)) vendido(item)
      where derivado.empresa_id = v_empresa_id
        and derivado.origem_venda_parcial_id = v_orc.id
        and (
          (nullif(v_item->>'id','') is not null and vendido.item->>'origem_item_id' = v_item->>'id')
          or (nullif(v_item->>'id','') is null and vendido.item->>'origem_item_indice' = v_indice::text)
        )
    ) into v_vendido_antes;
    if v_vendido_antes then raise exception 'Esta tipologia já foi vendida anteriormente'; end if;

    v_custo_item := coalesce(nullif(v_item->>'custo_total',''),nullif(v_item->>'custo_estimado',''));
    if v_custo_item is null or v_custo_item !~ '^[0-9]+([.][0-9]+)?$' then
      v_custo_incompleto := true;
    else
      v_custo_total := v_custo_total + v_custo_item::numeric;
    end if;
    v_item := v_item || jsonb_build_object(
      'origem_item_indice',v_indice,
      'origem_item_id',v_item->>'id',
      'preco_total_origem',v_item->'preco_total',
      'preco_total',v_preco,
      'preco_unit',case when coalesce((v_item->>'quantidade')::numeric,0)>0
        then round(v_preco/(v_item->>'quantidade')::numeric,2) else v_preco end
    );
    v_itens_vendidos := v_itens_vendidos || jsonb_build_array(v_item);
    v_valor_total := v_valor_total + v_preco;
    v_indices := array_append(v_indices,v_indice);
  end loop;
  if v_valor_total <= 0 then raise exception 'Informe o valor real dos itens vendidos'; end if;

  -- A confirmação não altera nenhuma tipologia, medida, foto ou valor do orçamento original.
  -- A cópia operacional contém somente os itens efetivamente vendidos.
  insert into public.orcamentos (
    empresa_id,cliente_id,obra_id,cliente_nome,cliente_whatsapp,cidade,
    origem,tipo_esquadria,largura_mm,altura_mm,quantidade,acabamento,contramarco,
    itens,descricao_livre,valor_estimado,custo_estimado,status,observacoes,
    condicoes,forma_pagamento,anexos,origem_venda_parcial_id
  ) values (
    v_empresa_id,v_orc.cliente_id,v_orc.obra_id,v_orc.cliente_nome,v_orc.cliente_whatsapp,v_orc.cidade,
    v_orc.origem,v_orc.tipo_esquadria,v_orc.largura_mm,v_orc.altura_mm,
    v_orc.quantidade,v_orc.acabamento,v_orc.contramarco,
    v_itens_vendidos,
    concat('Venda parcial do orçamento original #',coalesce(v_orc.numero::text,v_orc.id::text)),
    v_valor_total,case when v_custo_incompleto then null else v_custo_total end,
    'aprovado',
    concat('Venda parcial. Origem: orçamento #',coalesce(v_orc.numero::text,v_orc.id::text),
      '. Itens selecionados: ',array_to_string(v_indices,','),
      '. Conferir custo previsto quando não houver composição por item.'),
    v_orc.condicoes,v_orc.forma_pagamento,v_orc.anexos,v_orc.id
  ) returning id into v_novo_id;

  select f.venda_id,f.projeto_card_id,f.conta_id
  into v_venda_id,v_projeto_id,v_conta_id
  from public.fn_iniciar_fluxo_venda_v2(v_novo_id,v_auth_uid,p_usuario_nome) f limit 1;

  return query select v_venda_id,v_projeto_id,v_conta_id,v_novo_id;
end;
$$;

revoke all on function public.fn_iniciar_fluxo_venda_parcial_v1(uuid,jsonb,uuid,text) from public, anon;
grant execute on function public.fn_iniciar_fluxo_venda_parcial_v1(uuid,jsonb,uuid,text) to authenticated;
