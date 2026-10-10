-- Atlas One: fechamento de instalação/obra só após conferência integral.
-- Proteção conservadora, idempotente, com tenant explícito e sem backfill.
-- Rollback operacional (se estritamente necessário): restaurar a definição
-- anterior de fn_instalacao_concluida_v1 e remover o trigger BEFORE deste arquivo.
-- Não desfazer sem avaliar o risco de encerramentos incorretos.
create or replace function public.fn_validar_fechamento_obra_instalacao_v2(
  p_empresa_id uuid,
  p_obra_id uuid,
  p_orcamento_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_venda record;
  v_item record;
  v_inst record;
  v_total_vendas integer := 0;
  v_qtd_contas integer;
  v_total_contas numeric;
  v_saldo numeric;
  v_total_itens integer;
  v_qtd_produzida numeric;
  v_qtd_op_pendente integer;
  v_compra_pendente integer;
  v_ref text;
  v_qtd_prevista numeric;
begin
  if p_empresa_id is null or p_obra_id is null or p_orcamento_id is null then
    raise exception 'Vincule o card ao orçamento e à obra antes de concluir a Instalação.';
  end if;

  -- Serializa conclusões simultâneas de cards na mesma obra.
  perform 1 from public.obras b
    where b.id = p_obra_id and b.empresa_id = p_empresa_id
    for update;
  if not found then
    raise exception 'Obra vinculada ao card não encontrada nesta empresa.';
  end if;
  if not exists (
    select 1 from public.vendas_obras v
    where v.empresa_id = p_empresa_id and v.obra_id = p_obra_id
      and v.orcamento_id = p_orcamento_id
      and lower(coalesce(v.status,'')) not in ('cancelado','cancelada')
  ) then
    raise exception 'A venda deste card ainda não está vinculada à obra. Confira Cliente 360 e Área da Venda.';
  end if;

  -- A obra pode conter diversas vendas/orçamentos: todas devem estar conferidas.
  for v_venda in
    select v.id,v.numero,v.orcamento_id,v.valor_venda,v.itens_snapshot
    from public.vendas_obras v
    where v.empresa_id = p_empresa_id and v.obra_id = p_obra_id
      and lower(coalesce(v.status,'')) not in ('cancelada','cancelado')
    order by v.numero,v.id
  loop
    v_total_vendas := v_total_vendas + 1;
    if jsonb_typeof(v_venda.itens_snapshot) is distinct from 'array'
       or jsonb_array_length(v_venda.itens_snapshot) = 0 then
      raise exception 'Venda %: não existem tipologias estruturadas para conferir a instalação.',
        coalesce(v_venda.numero::text,v_venda.id::text);
    end if;

    select count(*),coalesce(sum(f.valor),0),
           coalesce(sum(greatest(0,f.valor-coalesce(f.valor_pago,0)-coalesce(f.valor_desconto,0))),0)
      into v_qtd_contas,v_total_contas,v_saldo
      from public.financeiro_contas_receber f
     where f.empresa_id = p_empresa_id and f.venda_obra_id = v_venda.id
       and lower(coalesce(f.status,'')) <> 'cancelado';
    if v_qtd_contas = 0 or abs(v_total_contas-coalesce(v_venda.valor_venda,0)) > 0.02 or v_saldo > 0.01 then
      raise exception 'Venda %: o Financeiro não está conciliado (parcelas, pagamentos e descontos).',
        coalesce(v_venda.numero::text,v_venda.id::text);
    end if;

    select count(*) into v_compra_pendente
      from public.compras_necessidades c
     where c.empresa_id=p_empresa_id and c.obra_id=p_obra_id
       and lower(coalesce(c.status,'')) not in ('recebido','cancelado','cancelada');
    if v_compra_pendente > 0 then
      raise exception 'Existem % necessidade(s) de compra da obra sem recebimento/baixa.',
        v_compra_pendente;
    end if;

    select count(*) into v_qtd_op_pendente
      from public.ordens_producao o
     where o.empresa_id=p_empresa_id and o.venda_obra_id=v_venda.id
       and lower(o.status) not in ('concluida','cancelada');
    if v_qtd_op_pendente > 0 then
      raise exception 'Venda %: existem % ordem(ns) de Produção ainda pendente(s).',
        coalesce(v_venda.numero::text,v_venda.id::text),v_qtd_op_pendente;
    end if;

    -- A quantidade de itens do checklist precisa corresponder ao orçamento vendido.
    select count(*) into v_total_itens
      from public.venda_instalacao_itens i
     where i.empresa_id=p_empresa_id and i.venda_obra_id=v_venda.id;
    if v_total_itens <> jsonb_array_length(v_venda.itens_snapshot) then
      raise exception 'Venda %: checklist não corresponde à quantidade de tipologias vendidas.',
        coalesce(v_venda.numero::text,v_venda.id::text);
    end if;

    for v_item in
      select e.value as item, e.ordinality as indice
      from jsonb_array_elements(v_venda.itens_snapshot) with ordinality as e(value,ordinality)
    loop
      v_ref := coalesce(nullif(v_item.item->>'id',''),'item-'||v_item.indice::text);
      v_qtd_prevista := case
        when coalesce(v_item.item->>'quantidade','') ~ '^[0-9]+([.][0-9]+)?$'
        then (v_item.item->>'quantidade')::numeric
        else 1
      end;
      if v_qtd_prevista <= 0 then
        raise exception 'Venda %: a tipologia % não tem quantidade válida.',
          coalesce(v_venda.numero::text,v_venda.id::text),v_ref;
      end if;

      select i.id,i.quantidade,i.quantidade_instalada,i.status,i.pendencia,i.checklist
        into v_inst
        from public.venda_instalacao_itens i
       where i.empresa_id=p_empresa_id and i.venda_obra_id=v_venda.id and i.item_ref=v_ref;
      if not found then
        raise exception 'Venda %: falta checklist de instalação para a tipologia %.',
          coalesce(v_venda.numero::text,v_venda.id::text),v_ref;
      end if;
      if v_inst.status <> 'instalado'
         or v_inst.quantidade <> v_qtd_prevista
         or v_inst.quantidade_instalada <> v_qtd_prevista
         or nullif(btrim(coalesce(v_inst.pendencia,'')),'') is not null
         or not (
           v_inst.checklist @> '{"nivelamento":true,"vedacao":true,"acabamento":true,"limpeza":true}'::jsonb
         )
      then
        raise exception 'Venda %: a tipologia % tem instalação, quantidade, checklist ou pendência sem conferir.',
          coalesce(v_venda.numero::text,v_venda.id::text),v_ref;
      end if;

      select coalesce(sum(o.quantidade),0) into v_qtd_produzida
        from public.ordens_producao o
       where o.empresa_id=p_empresa_id and o.venda_obra_id=v_venda.id
         and o.item_ref=v_ref and o.tipo_producao='esquadria'
         and o.status='concluida' and not o.bloqueada;
      if v_qtd_produzida < v_qtd_prevista then
        raise exception 'Venda %: a tipologia % ainda não tem % peça(s) produzida(s) e liberada(s).',
          coalesce(v_venda.numero::text,v_venda.id::text),v_ref,v_qtd_prevista;
      end if;
    end loop;

    if not exists (
      select 1 from public.setor_kanban_itens k
      join public.setor_kanban_colunas c
        on c.id=k.coluna_id and c.empresa_id=k.empresa_id
      where k.empresa_id=p_empresa_id and k.orcamento_id=v_venda.orcamento_id
        and c.setor_id='instalacao'
    ) then
      raise exception 'Venda %: não existe card de Instalação associado ao orçamento.',
        coalesce(v_venda.numero::text,v_venda.id::text);
    end if;
  end loop;
  if v_total_vendas=0 then
    raise exception 'Obra sem venda ativa vinculada: conclusão bloqueada.';
  end if;
end;
$$;

create or replace function public.fn_bloquear_fechamento_instalacao_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_setor text;
  v_coluna text;
begin
  if new.coluna_id is not distinct from old.coluna_id then return new; end if;
  select c.setor_id,lower(btrim(c.nome)) into v_setor,v_coluna
    from public.setor_kanban_colunas c
   where c.id=new.coluna_id and c.empresa_id=new.empresa_id;
  if v_setor='instalacao' and v_coluna in ('concluída','concluida','concluído','concluido') then
    perform public.fn_validar_fechamento_obra_instalacao_v2(new.empresa_id,new.obra_id,new.orcamento_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_fechamento_instalacao_v2 on public.setor_kanban_itens;
create trigger trg_bloquear_fechamento_instalacao_v2
before update of coluna_id on public.setor_kanban_itens
for each row execute function public.fn_bloquear_fechamento_instalacao_v2();

-- Preserva nome, integração de workflow e trigger originais, mas evita
-- finalizar a obra com outro card da mesma obra ainda fora de Concluída.
create or replace function public.fn_instalacao_concluida_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_setor text;
  v_nome text;
  v_pendentes integer;
  v_atualizada uuid;
begin
  if new.coluna_id is not distinct from old.coluna_id then return new; end if;
  select c.setor_id,lower(btrim(c.nome)) into v_setor,v_nome
    from public.setor_kanban_colunas c
   where c.id=new.coluna_id and c.empresa_id=new.empresa_id;

  if v_setor='instalacao' and v_nome in ('concluída','concluida','concluído','concluido') then
    -- Dupla checagem mesmo se o trigger BEFORE tiver sido desativado.
    perform public.fn_validar_fechamento_obra_instalacao_v2(new.empresa_id,new.obra_id,new.orcamento_id);
    select count(*) into v_pendentes
      from public.setor_kanban_itens k
      join public.setor_kanban_colunas c
        on c.id=k.coluna_id and c.empresa_id=k.empresa_id
      where k.empresa_id=new.empresa_id and k.id<>new.id
        and c.setor_id='instalacao'
        and exists (
          select 1 from public.vendas_obras v
          where v.empresa_id=k.empresa_id and v.obra_id=new.obra_id
            and v.orcamento_id=k.orcamento_id
            and lower(coalesce(v.status,'')) not in ('cancelado','cancelada')
        )
        and lower(btrim(c.nome)) not in ('concluída','concluida','concluído','concluido');

    if v_pendentes=0 then
      update public.obras set status='concluida',updated_at=now()
       where id=new.obra_id and empresa_id=new.empresa_id
         and status is distinct from 'concluida'
       returning id into v_atualizada;
      if v_atualizada is not null then
        perform public.fn_workflow_disparar_evento_v1(
          'instalacao_concluida',new.orcamento_id,new.id::text,
          new.atualizado_por_id,new.atualizado_por_nome
        );
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_validar_fechamento_obra_instalacao_v2(uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.fn_bloquear_fechamento_instalacao_v2() from public,anon,authenticated;
revoke execute on function public.fn_instalacao_concluida_v1() from public,anon,authenticated;
