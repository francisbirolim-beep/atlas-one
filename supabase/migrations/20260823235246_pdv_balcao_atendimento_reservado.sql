-- Atlas One — atendimento de vendas balcão reservadas em outra unidade.
-- Fluxo: reservado -> separando -> em_entrega -> entregue.
-- A reserva existente continua sendo a fonte da verdade; não criar nova reserva.

alter table public.balcao_venda_itens
  drop constraint if exists balcao_venda_itens_atendimento_status_check;

alter table public.balcao_venda_itens
  add constraint balcao_venda_itens_atendimento_status_check
  check (atendimento_status in ('entregue','reservado_outra_unidade','separando','em_entrega','cancelado'));

alter table public.balcao_venda_itens
  add column if not exists separado_em timestamptz,
  add column if not exists separado_por_id uuid references auth.users(id),
  add column if not exists separado_por_nome text,
  add column if not exists enviado_em timestamptz,
  add column if not exists enviado_por_id uuid references auth.users(id),
  add column if not exists enviado_por_nome text,
  add column if not exists entregue_em timestamptz,
  add column if not exists entregue_por_id uuid references auth.users(id),
  add column if not exists entregue_por_nome text,
  add column if not exists atendimento_observacoes text;

create index if not exists idx_balcao_venda_itens_atendimento
  on public.balcao_venda_itens(atendimento_status, local_origem_id, created_at desc);

create or replace function public.avancar_atendimento_venda_balcao(
  p_item_id uuid,
  p_acao text,
  p_usuario_id uuid,
  p_usuario_nome text,
  p_observacoes text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  i record;
  v record;
  r record;
  s record;
  v_acao text := lower(trim(coalesce(p_acao,'')));
  v_qtd_reservada numeric := 0;
  v_pendentes integer := 0;
  v_entregues integer := 0;
  v_status_venda text;
begin
  select * into i from public.balcao_venda_itens where id=p_item_id for update;
  if i.id is null then raise exception 'Item da venda não encontrado.'; end if;

  select * into v from public.balcao_vendas where id=i.venda_id for update;
  if v.id is null then raise exception 'Venda não encontrada.'; end if;
  if v.status<>'finalizada' then raise exception 'Somente venda finalizada pode avançar no atendimento.'; end if;
  if i.local_origem_id is null then raise exception 'Item sem local de origem.'; end if;

  if v_acao='separar' then
    if i.atendimento_status='separando' then
      return jsonb_build_object('ok',true,'status','separando','idempotente',true);
    end if;
    if i.atendimento_status<>'reservado_outra_unidade' then
      raise exception 'Item não pode iniciar separação no status atual: %.',i.atendimento_status;
    end if;
    if not exists(
      select 1 from public.estoque_reservas
      where origem_tipo='venda_balcao' and origem_id=i.venda_id
        and produto_id=i.produto_id and local_id=i.local_origem_id and status='ativa'
    ) then raise exception 'Reserva ativa da venda não encontrada.'; end if;

    update public.balcao_venda_itens
      set atendimento_status='separando',
          separado_em=coalesce(separado_em,now()),
          separado_por_id=coalesce(separado_por_id,p_usuario_id),
          separado_por_nome=coalesce(separado_por_nome,p_usuario_nome),
          atendimento_observacoes=concat_ws(E'\n',atendimento_observacoes,nullif(trim(p_observacoes),''))
      where id=i.id;

  elsif v_acao='enviar' then
    if i.atendimento_status='em_entrega' then
      return jsonb_build_object('ok',true,'status','em_entrega','idempotente',true);
    end if;
    if i.atendimento_status<>'separando' then
      raise exception 'O item precisa estar em separação antes do envio.';
    end if;

    for r in
      select * from public.estoque_reservas
      where origem_tipo='venda_balcao' and origem_id=i.venda_id
        and produto_id=i.produto_id and local_id=i.local_origem_id and status='ativa'
      order by created_at,id
      for update
    loop
      select * into s from public.estoque_saldos
      where produto_id=r.produto_id and local_id=r.local_id
        and (endereco_id is not distinct from r.endereco_id)
      for update;
      if s.id is null or s.quantidade<r.quantidade or s.quantidade_reservada<r.quantidade then
        raise exception 'Saldo reservado inconsistente para o item %.',i.produto_nome;
      end if;

      update public.estoque_saldos
        set quantidade=quantidade-r.quantidade,
            quantidade_reservada=quantidade_reservada-r.quantidade,
            valor_estoque=greatest(0,valor_estoque-(r.quantidade*coalesce(custo_medio,0))),
            updated_at=now()
        where id=s.id;

      insert into public.estoque_movimentos(
        produto_id,tipo,quantidade,unidade,custo_unitario,valor_total,
        origem_tipo,origem_id,observacoes,criado_por_id,criado_por_nome,
        local_origem_id,endereco_origem_id
      ) values(
        i.produto_id,'saida',r.quantidade,coalesce(s.unidade,i.unidade),
        coalesce(s.custo_medio,i.custo_unitario_snapshot,0),
        r.quantidade*coalesce(s.custo_medio,i.custo_unitario_snapshot,0),
        'venda_balcao_envio',i.venda_id,
        'Envio ao cliente da venda balcão #'||v.numero,
        p_usuario_id,p_usuario_nome,r.local_id,r.endereco_id
      );

      update public.estoque_reservas set status='atendida',updated_at=now() where id=r.id;
      v_qtd_reservada:=v_qtd_reservada+r.quantidade;
    end loop;

    if v_qtd_reservada<>i.quantidade then
      raise exception 'Quantidade reservada (%) diferente da quantidade vendida (%).',v_qtd_reservada,i.quantidade;
    end if;

    update public.balcao_venda_itens
      set atendimento_status='em_entrega',
          enviado_em=coalesce(enviado_em,now()),
          enviado_por_id=coalesce(enviado_por_id,p_usuario_id),
          enviado_por_nome=coalesce(enviado_por_nome,p_usuario_nome),
          atendimento_observacoes=concat_ws(E'\n',atendimento_observacoes,nullif(trim(p_observacoes),''))
      where id=i.id;

  elsif v_acao='entregar' then
    if i.atendimento_status='entregue' then
      return jsonb_build_object('ok',true,'status','entregue','idempotente',true);
    end if;
    if i.atendimento_status<>'em_entrega' then
      raise exception 'O item precisa estar em entrega antes da confirmação.';
    end if;

    update public.balcao_venda_itens
      set atendimento_status='entregue',
          entregue_em=coalesce(entregue_em,now()),
          entregue_por_id=coalesce(entregue_por_id,p_usuario_id),
          entregue_por_nome=coalesce(entregue_por_nome,p_usuario_nome),
          atendimento_observacoes=concat_ws(E'\n',atendimento_observacoes,nullif(trim(p_observacoes),''))
      where id=i.id;
  else
    raise exception 'Ação de atendimento inválida.';
  end if;

  select
    count(*) filter (where atendimento_status not in ('entregue','cancelado')),
    count(*) filter (where atendimento_status='entregue')
  into v_pendentes,v_entregues
  from public.balcao_venda_itens where venda_id=i.venda_id;

  if v_pendentes=0 then
    v_status_venda:='entregue';
  elsif v_entregues>0 then
    v_status_venda:='parcial';
  else
    v_status_venda:='aguardando_separacao';
  end if;

  update public.balcao_vendas set atendimento_status=v_status_venda where id=i.venda_id;

  return jsonb_build_object(
    'ok',true,
    'itemId',i.id,
    'vendaId',i.venda_id,
    'numero',v.numero,
    'status',case when v_acao='separar' then 'separando' when v_acao='enviar' then 'em_entrega' else 'entregue' end,
    'atendimentoStatusVenda',v_status_venda
  );
end;
$$;

revoke all on function public.avancar_atendimento_venda_balcao(uuid,text,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.avancar_atendimento_venda_balcao(uuid,text,uuid,text,text)
  to service_role;
