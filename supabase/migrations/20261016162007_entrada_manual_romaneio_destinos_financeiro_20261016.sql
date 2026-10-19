-- Extensão aditiva para destinar cada produto do romaneio, inclusive parcialmente,
-- e registrar Contas a Pagar na mesma transação. Não modifica o recebimento fiscal.
begin;

alter table public.compras_entradas_manuais drop constraint if exists compras_entradas_manuais_destino_check;
alter table public.compras_entradas_manuais
  add constraint compras_entradas_manuais_destino_check check (destino in ('obra','estoque','misto'));
alter table public.compras_entradas_manuais drop constraint if exists manual_destino_coerente;
alter table public.compras_entradas_manuais
  add constraint manual_destino_coerente check (
    (destino='obra' and cliente_id is not null and obra_id is not null and local_id is null)
    or (destino='estoque' and cliente_id is null and obra_id is null and local_id is not null)
    or (destino='misto' and cliente_id is null and obra_id is null and local_id is null)
  );

create table if not exists public.compras_entradas_manuais_destinos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  entrada_id uuid not null references public.compras_entradas_manuais(id) on delete restrict,
  item_id uuid not null references public.compras_entradas_manuais_itens(id) on delete restrict,
  destino text not null check (destino in ('obra','estoque')),
  quantidade numeric(16,4) not null check (quantidade>0),
  cliente_id uuid references public.clientes(id) on delete restrict,
  obra_id uuid references public.obras(id) on delete restrict,
  local_id uuid references public.estoque_locais(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint romaneio_destino_exclusivo check (
    (destino='obra' and cliente_id is not null and obra_id is not null and local_id is null)
    or (destino='estoque' and cliente_id is null and obra_id is null and local_id is not null)
  )
);
create index if not exists idx_romaneio_destinos_obra on public.compras_entradas_manuais_destinos(empresa_id,obra_id,entrada_id);
create index if not exists idx_romaneio_destinos_local on public.compras_entradas_manuais_destinos(empresa_id,local_id,entrada_id);

alter table public.compras_entradas_manuais_destinos enable row level security;
revoke all on public.compras_entradas_manuais_destinos from public,anon,authenticated;
grant select,insert on public.compras_entradas_manuais_destinos to service_role;

alter table public.financeiro_contas_pagar
  add column if not exists entrada_manual_id uuid references public.compras_entradas_manuais(id) on delete restrict;
create unique index if not exists uq_contas_pagar_entrada_manual
  on public.financeiro_contas_pagar(entrada_manual_id) where entrada_manual_id is not null;

create or replace function public.registrar_entrada_manual_romaneio_dividido(
  p_empresa_id uuid, p_usuario_id uuid, p_chave_idempotencia uuid,
  p_fornecedor_nome text, p_numero_romaneio text, p_data_documento date,
  p_observacoes text, p_vencimento date, p_itens jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_usuario record;
  v_entrada_id uuid;
  v_existente uuid;
  v_produto record;
  v_item jsonb;
  v_aloc jsonb;
  v_item_id uuid;
  v_destino_id uuid;
  v_quantidade numeric;
  v_aloc_quantidade numeric;
  v_distribuido numeric;
  v_custo numeric;
  v_saldo record;
  v_qtd numeric;
  v_valor numeric;
  v_custo_medio numeric;
  v_local_id uuid;
  v_cliente_id uuid;
  v_obra_id uuid;
  v_tipo text;
  v_total integer := 0;
  v_total_valor numeric := 0;
  v_conta_id uuid;
begin
  select id,nome into v_usuario from public.usuarios
    where id=p_usuario_id and empresa_id=p_empresa_id;
  if not found then raise exception 'Usuário sem vínculo com a empresa'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_empresa_id::text || ':' || p_chave_idempotencia::text,0));
  select id into v_existente from public.compras_entradas_manuais
    where empresa_id=p_empresa_id and chave_idempotencia=p_chave_idempotencia;
  if found then
    return jsonb_build_object('ok',true,'entradaId',v_existente,'duplicado',true);
  end if;
  if length(btrim(coalesce(p_fornecedor_nome,'')))=0
     or length(btrim(coalesce(p_numero_romaneio,'')))=0
     or length(btrim(p_fornecedor_nome))>200 or length(btrim(p_numero_romaneio))>100
  then raise exception 'Informe fornecedor e número do romaneio'; end if;
  if p_data_documento is null then raise exception 'Informe a data do romaneio'; end if;
  if p_itens is null or jsonb_typeof(p_itens)<>'array'
    or jsonb_array_length(p_itens)<1 or jsonb_array_length(p_itens)>100
  then raise exception 'Informe de 1 a 100 produtos'; end if;
  if exists (
    select 1 from public.compras_entradas_manuais
    where empresa_id=p_empresa_id
      and lower(btrim(fornecedor_nome))=lower(btrim(p_fornecedor_nome))
      and lower(btrim(numero_romaneio))=lower(btrim(p_numero_romaneio))
  ) then raise exception 'Este fornecedor e romaneio já possuem uma entrada registrada'; end if;

  insert into public.compras_entradas_manuais(
    empresa_id,fornecedor_nome,numero_romaneio,data_documento,destino,
    observacoes,chave_idempotencia,criado_por_id,criado_por_nome
  ) values (
    p_empresa_id,btrim(p_fornecedor_nome),btrim(p_numero_romaneio),p_data_documento,'misto',
    nullif(btrim(left(coalesce(p_observacoes,''),2000)),''),
    p_chave_idempotencia,p_usuario_id,v_usuario.nome
  ) returning id into v_entrada_id;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    if coalesce(v_item->>'produtoId','')!~'^[0-9a-fA-F-]{36}$'
      or coalesce(v_item->>'quantidade','')!~'^[0-9]+([.][0-9]+)?$'
      or coalesce(v_item->>'custoUnitario','')!~'^[0-9]+([.][0-9]+)?$'
    then raise exception 'Produto, quantidade e custo unitário obrigatórios'; end if;
    v_quantidade:=(v_item->>'quantidade')::numeric;
    v_custo:=(v_item->>'custoUnitario')::numeric;
    if v_quantidade<=0 or v_quantidade>100000000 or scale(v_quantidade)>4
      or v_custo<0 or v_custo>100000000 or scale(v_custo)>4
    then raise exception 'Quantidade ou custo fora do limite permitido'; end if;
    select id,nome,unidade into v_produto from public.produtos
      where empresa_id=p_empresa_id and id=(v_item->>'produtoId')::uuid and ativo=true;
    if not found then raise exception 'Produto não encontrado na empresa'; end if;

    if jsonb_typeof(v_item->'destinos')<>'array'
      or jsonb_array_length(v_item->'destinos')<1
      or jsonb_array_length(v_item->'destinos')>20
    then raise exception 'Informe ao menos um destino para cada produto'; end if;
    insert into public.compras_entradas_manuais_itens(
      empresa_id,entrada_id,produto_id,descricao,unidade,quantidade,custo_unitario
    ) values (
      p_empresa_id,v_entrada_id,v_produto.id,v_produto.nome,
      v_produto.unidade,v_quantidade,v_custo
    ) returning id into v_item_id;
    v_distribuido:=0;

    for v_aloc in select value from jsonb_array_elements(v_item->'destinos') loop
      v_tipo:=v_aloc->>'destino';
      if coalesce(v_aloc->>'quantidade','')!~'^[0-9]+([.][0-9]+)?$'
        then raise exception 'Quantidade de destino inválida'; end if;
      v_aloc_quantidade:=(v_aloc->>'quantidade')::numeric;
      if v_aloc_quantidade<=0 or scale(v_aloc_quantidade)>4
        then raise exception 'Quantidade de destino inválida'; end if;
      v_distribuido:=v_distribuido+v_aloc_quantidade;
      if v_distribuido>v_quantidade then
        raise exception 'A soma dos destinos excede a quantidade recebida'; end if;
      if v_tipo='obra' then
        v_cliente_id:=nullif(v_aloc->>'clienteId','')::uuid;
        v_obra_id:=nullif(v_aloc->>'obraId','')::uuid;
        v_local_id:=null;
        if v_cliente_id is null or v_obra_id is null
          or not exists(
            select 1 from public.obras o join public.clientes c on c.id=o.cliente_id
              where o.id=v_obra_id and o.cliente_id=v_cliente_id
              and o.empresa_id=p_empresa_id and c.empresa_id=p_empresa_id
          ) then raise exception 'A obra não pertence ao cliente informado'; end if;
      elsif v_tipo='estoque' then
        v_cliente_id:=null;
        v_obra_id:=null;
        v_local_id:=nullif(v_aloc->>'localId','')::uuid;
        if v_local_id is null or not exists(
          select 1 from public.estoque_locais
          where id=v_local_id and empresa_id=p_empresa_id and ativo=true and tipo='geral'
        ) then raise exception 'Escolha um local de Estoque Geral da empresa'; end if;
      else raise exception 'Destino inválido para o produto'; end if;

      insert into public.compras_entradas_manuais_destinos(
        empresa_id,entrada_id,item_id,destino,quantidade,cliente_id,obra_id,local_id
      ) values (
        p_empresa_id,v_entrada_id,v_item_id,v_tipo,v_aloc_quantidade,
        v_cliente_id,v_obra_id,v_local_id
      ) returning id into v_destino_id;

      if v_tipo='estoque' then
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
          p_empresa_id::text || ':' || v_produto.id::text || ':' || v_local_id::text,0));
        select * into v_saldo from public.estoque_saldos
          where empresa_id=p_empresa_id and produto_id=v_produto.id
            and local_id=v_local_id and endereco_id is null for update;
        if not found then
          v_qtd:=v_aloc_quantidade;
          v_valor:=v_aloc_quantidade*v_custo;
          v_custo_medio:=v_custo;
          insert into public.estoque_saldos(
            empresa_id,produto_id,local_id,endereco_id,unidade,quantidade,
            quantidade_reservada,custo_medio,valor_estoque
          ) values (
            p_empresa_id,v_produto.id,v_local_id,null,v_produto.unidade,
            v_qtd,0,v_custo_medio,v_valor
          );
        else
          v_qtd:=v_saldo.quantidade+v_aloc_quantidade;
          v_valor:=coalesce(v_saldo.valor_estoque,0)+v_aloc_quantidade*v_custo;
          v_custo_medio:=case when v_qtd>0 then v_valor/v_qtd else v_saldo.custo_medio end;
          update public.estoque_saldos
            set quantidade=v_qtd,valor_estoque=v_valor,
                custo_medio=v_custo_medio,updated_at=now()
            where id=v_saldo.id and empresa_id=p_empresa_id;
        end if;
        insert into public.estoque_movimentos(
          empresa_id,produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,
          origem_tipo,origem_id,local_destino_id,observacoes,criado_por_id,criado_por_nome
        ) values (
          p_empresa_id,v_produto.id,'entrada',v_aloc_quantidade,v_produto.unidade,
          v_custo,v_aloc_quantidade*v_custo,'entrada_manual_romaneio',v_destino_id,
          v_local_id,'Romaneio '||btrim(p_numero_romaneio),p_usuario_id,v_usuario.nome
        );
      end if;
    end loop;
    if v_distribuido<>v_quantidade then
      raise exception 'A soma dos destinos deve ser igual à quantidade recebida'; end if;
    v_total_valor:=v_total_valor+v_quantidade*v_custo;
    v_total:=v_total+1;
  end loop;

  insert into public.financeiro_contas_pagar(
    empresa_id,fornecedor_nome,documento,parcela,descricao,
    data_emissao,vencimento,valor,status,origem,
    criado_por_id,criado_por_nome,entrada_manual_id
  ) values (
    p_empresa_id,btrim(p_fornecedor_nome),'ROM '||btrim(p_numero_romaneio),
    '1','Recebimento por romaneio',p_data_documento,p_vencimento,
    round(v_total_valor,2),
    case when p_vencimento is null then 'pendente_vencimento' else 'aberto' end,
    'entrada_manual_romaneio',p_usuario_id,v_usuario.nome,v_entrada_id
  ) returning id into v_conta_id;

  return jsonb_build_object(
    'ok',true,'entradaId',v_entrada_id,'contaPagarId',v_conta_id,
    'valorTotal',round(v_total_valor,2),'duplicado',false,'itensRegistrados',v_total
  );
end;
$$;
revoke all on function public.registrar_entrada_manual_romaneio_dividido(
  uuid,uuid,uuid,text,text,date,text,date,jsonb
) from public,anon,authenticated;
grant execute on function public.registrar_entrada_manual_romaneio_dividido(
  uuid,uuid,uuid,text,text,date,text,date,jsonb
) to service_role;