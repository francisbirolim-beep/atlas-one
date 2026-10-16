-- Entrada manual por romaneio: fluxo independente das notas fiscais.
-- Migração aditiva. Sem alteração nas rotinas homologadas de NF, estoque e Compras.
begin;

create table if not exists public.compras_entradas_manuais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  fornecedor_nome text not null,
  numero_romaneio text not null,
  data_documento date not null,
  destino text not null check (destino in ('obra','estoque')),
  cliente_id uuid references public.clientes(id) on delete restrict,
  obra_id uuid references public.obras(id) on delete restrict,
  local_id uuid references public.estoque_locais(id) on delete restrict,
  observacoes text,
  chave_idempotencia uuid not null,
  criado_por_id uuid not null references auth.users(id),
  criado_por_nome text not null,
  created_at timestamptz not null default now(),
  constraint manual_destino_coerente check (
    (destino='obra' and cliente_id is not null and obra_id is not null and local_id is null)
    or (destino='estoque' and cliente_id is null and obra_id is null and local_id is not null)
  ),
  constraint manual_fornecedor_informado check (length(btrim(fornecedor_nome))>0),
  constraint manual_romaneio_informado check (length(btrim(numero_romaneio))>0),
  constraint manual_chave_unica unique (empresa_id,chave_idempotencia)
);
create unique index if not exists compras_entradas_manuais_romaneio_unico
  on public.compras_entradas_manuais(empresa_id, lower(btrim(fornecedor_nome)),lower(btrim(numero_romaneio)));
create index if not exists compras_entradas_manuais_obra_idx on public.compras_entradas_manuais(empresa_id,obra_id,created_at desc);
create index if not exists compras_entradas_manuais_estoque_idx on public.compras_entradas_manuais(empresa_id,local_id,created_at desc);

create table if not exists public.compras_entradas_manuais_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  entrada_id uuid not null references public.compras_entradas_manuais(id) on delete restrict,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  descricao text not null,
  unidade text,
  quantidade numeric(16,4) not null check(quantidade>0),
  custo_unitario numeric(16,4) check(custo_unitario is null or custo_unitario>=0),
  created_at timestamptz not null default now()
);
create index if not exists compras_entradas_manuais_itens_entrada_idx on public.compras_entradas_manuais_itens(empresa_id,entrada_id);
create unique index if not exists estoque_entrada_manual_item_unico
  on public.estoque_movimentos(empresa_id,origem_id)
  where origem_tipo='entrada_manual_romaneio' and tipo='entrada';

alter table public.compras_entradas_manuais enable row level security;
alter table public.compras_entradas_manuais_itens enable row level security;
revoke all on public.compras_entradas_manuais from public,anon,authenticated;
revoke all on public.compras_entradas_manuais_itens from public,anon,authenticated;
grant select,insert on public.compras_entradas_manuais to service_role;
grant select,insert on public.compras_entradas_manuais_itens to service_role;

-- Uma única transação registra documento, itens e saldos: falha implica rollback integral.
create or replace function public.registrar_entrada_manual_romaneio(
  p_empresa_id uuid, p_usuario_id uuid, p_chave_idempotencia uuid,
  p_fornecedor_nome text, p_numero_romaneio text, p_data_documento date,
  p_destino text, p_cliente_id uuid, p_obra_id uuid, p_local_id uuid,
  p_observacoes text, p_itens jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_usuario record;
  v_entrada_id uuid;
  v_existente uuid;
  v_produto record;
  v_item jsonb;
  v_item_id uuid;
  v_quantidade numeric;
  v_custo numeric;
  v_saldo record;
  v_qtd numeric;
  v_valor numeric;
  v_custo_medio numeric;
  v_total integer := 0;
begin
  select id,nome into v_usuario from public.usuarios
   where id=p_usuario_id and empresa_id=p_empresa_id;
  if not found then raise exception 'Usuário sem vínculo com a empresa'; end if;

  -- Serialização do mesmo submit mesmo quando os dois cliques chegam juntos.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_empresa_id::text || ':' || p_chave_idempotencia::text, 0));
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
  if p_destino not in ('obra','estoque') or p_destino is null
    then raise exception 'Escolha um destino válido'; end if;
  if p_itens is null or jsonb_typeof(p_itens)<>'array'
     or jsonb_array_length(p_itens)<1 or jsonb_array_length(p_itens)>100
    then raise exception 'Informe de 1 a 100 produtos'; end if;

  if p_destino='obra' then
    if p_cliente_id is null or p_obra_id is null or p_local_id is not null
      then raise exception 'Escolha um cliente e a obra correta'; end if;
    if not exists (
      select 1 from public.obras o join public.clientes c on c.id=o.cliente_id
      where o.id=p_obra_id and o.cliente_id=p_cliente_id
        and o.empresa_id=p_empresa_id and c.empresa_id=p_empresa_id
    ) then raise exception 'A obra não pertence ao cliente informado'; end if;
  else
    if p_cliente_id is not null or p_obra_id is not null or p_local_id is null
      then raise exception 'Entrada de estoque não deve vincular cliente/obra'; end if;
    if not exists (
      select 1 from public.estoque_locais l
      where l.id=p_local_id and l.empresa_id=p_empresa_id
        and l.ativo=true and l.tipo='geral'
    ) then raise exception 'Escolha um local de Estoque Geral da empresa'; end if;
  end if;

  -- Mesmo fornecedor + mesmo romaneio não pode originar duas entradas físicas.
  if exists (
    select 1 from public.compras_entradas_manuais
      where empresa_id=p_empresa_id
      and lower(btrim(fornecedor_nome))=lower(btrim(p_fornecedor_nome))
      and lower(btrim(numero_romaneio))=lower(btrim(p_numero_romaneio))
  ) then raise exception 'Este fornecedor e romaneio já possuem uma entrada registrada'; end if;

  insert into public.compras_entradas_manuais (
    empresa_id,fornecedor_nome,numero_romaneio,data_documento,destino,
    cliente_id,obra_id,local_id,observacoes,chave_idempotencia,criado_por_id,criado_por_nome
  ) values (
    p_empresa_id,btrim(p_fornecedor_nome),btrim(p_numero_romaneio),p_data_documento,p_destino,
    p_cliente_id,p_obra_id,p_local_id,nullif(btrim(left(coalesce(p_observacoes,''),2000)),''),p_chave_idempotencia,p_usuario_id,v_usuario.nome
  ) returning id into v_entrada_id;

  for v_item in select value from jsonb_array_elements(p_itens) loop
    if (v_item->>'produtoId') is null
       or (v_item->>'quantidade') is null
       or (v_item->>'quantidade')!~'^[0-9]+([.][0-9]+)?$'
      then raise exception 'Produto e quantidade positiva obrigatórios'; end if;
    v_quantidade := (v_item->>'quantidade')::numeric;
    if v_quantidade<=0 or v_quantidade>100000000
      then raise exception 'Quantidade fora do limite permitido'; end if;
    if coalesce(v_item->>'custoUnitario','')<>'' then
      if (v_item->>'custoUnitario')!~'^[0-9]+([.][0-9]+)?$'
        then raise exception 'Custo unitário inválido'; end if;
      v_custo:=(v_item->>'custoUnitario')::numeric;
    else v_custo:=null; end if;
    select id,nome,unidade,custo into v_produto from public.produtos
      where empresa_id=p_empresa_id and id=(v_item->>'produtoId')::uuid and ativo=true;
    if not found then raise exception 'Produto não encontrado na empresa'; end if;
    v_custo:=coalesce(v_custo,v_produto.custo);
    insert into public.compras_entradas_manuais_itens (
      empresa_id,entrada_id,produto_id,descricao,unidade,quantidade,custo_unitario
    ) values (
      p_empresa_id,v_entrada_id,v_produto.id,v_produto.nome,v_produto.unidade,v_quantidade,v_custo
    ) returning id into v_item_id;
    v_total:=v_total+1;

    if p_destino='estoque' then
      -- Lock por local e produto, inclusive se o saldo ainda não existe.
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        p_empresa_id::text || ':' || v_produto.id::text || ':' || p_local_id::text,0));
      select * into v_saldo from public.estoque_saldos
        where empresa_id=p_empresa_id and produto_id=v_produto.id
          and local_id=p_local_id and endereco_id is null for update;
      if not found then
        v_qtd:=v_quantidade;
        v_valor:=v_quantidade*coalesce(v_custo,0);
        v_custo_medio:=case when v_qtd>0 then v_valor/v_qtd else null end;
        insert into public.estoque_saldos (
          empresa_id,produto_id,local_id,endereco_id,unidade,quantidade,quantidade_reservada,custo_medio,valor_estoque
        ) values (
          p_empresa_id,v_produto.id,p_local_id,null,v_produto.unidade,v_qtd,0,v_custo_medio,v_valor
        );
      else
        v_qtd:=v_saldo.quantidade+v_quantidade;
        v_valor:=coalesce(v_saldo.valor_estoque,0)+v_quantidade*coalesce(v_custo,0);
        v_custo_medio:=case when v_qtd>0 then v_valor/v_qtd else v_saldo.custo_medio end;
        update public.estoque_saldos
          set quantidade=v_qtd,valor_estoque=v_valor,custo_medio=v_custo_medio,updated_at=now()
          where id=v_saldo.id and empresa_id=p_empresa_id;
      end if;
      insert into public.estoque_movimentos (
        empresa_id,produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,
        origem_tipo,origem_id,local_destino_id,observacoes,criado_por_id,criado_por_nome
      ) values (
        p_empresa_id,v_produto.id,'entrada',v_quantidade,v_produto.unidade,v_custo,
        v_quantidade*coalesce(v_custo,0),'entrada_manual_romaneio',v_item_id,p_local_id,
        'Romaneio '||btrim(p_numero_romaneio),p_usuario_id,v_usuario.nome
      );
    end if;
  end loop;
  return jsonb_build_object('ok',true,'entradaId',v_entrada_id,'duplicado',false,
    'itensRegistrados',v_total,'destino',p_destino,'estoqueMovimentado',p_destino='estoque');
end;
$$;
revoke all on function public.registrar_entrada_manual_romaneio(
 uuid,uuid,uuid,text,text,date,text,uuid,uuid,uuid,text,jsonb
) from public,anon,authenticated;
grant execute on function public.registrar_entrada_manual_romaneio(
 uuid,uuid,uuid,text,text,date,text,uuid,uuid,uuid,text,jsonb
) to service_role;
commit;
