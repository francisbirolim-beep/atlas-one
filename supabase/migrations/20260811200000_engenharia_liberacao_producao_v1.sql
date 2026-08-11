-- Engenharia Fase 4: liberacao operacional real para Producao.
-- Mantem a conferencia como trava e cria/atualiza de forma idempotente o card da Producao.

alter table public.setor_kanban_itens
  add column if not exists liberado_producao_em timestamptz,
  add column if not exists liberado_producao_por_id uuid,
  add column if not exists liberado_producao_por_nome text;

create unique index if not exists producao_itens_orcamento_id_uidx
  on public.producao_itens (orcamento_id)
  where orcamento_id is not null;

create or replace function public.fn_engenharia_liberar_para_producao(
  p_card_id uuid,
  p_coluna_id uuid,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.setor_kanban_itens%rowtype;
  v_destino_nome text;
  v_medicao_id uuid;
  v_total_itens integer;
  v_total_conferidos integer;
  v_producao_coluna_id uuid;
begin
  select * into v_card from public.setor_kanban_itens where id = p_card_id for update;
  if not found then raise exception 'Obra da Engenharia nao encontrada'; end if;

  select nome into v_destino_nome from public.setor_kanban_colunas where id = p_coluna_id;
  if v_destino_nome is null then raise exception 'Etapa de destino da Engenharia nao encontrada'; end if;

  if lower(v_destino_nome) like '%liberad%produ%' then
    if v_card.orcamento_id is null then
      raise exception 'Nao foi possivel identificar o orcamento da obra para liberar a Producao';
    end if;

    select mf.id into v_medicao_id
      from public.medicoes_finais mf
     where mf.orcamento_id = v_card.orcamento_id and mf.status_operacional = 'aprovado'
     order by mf.aprovado_em desc nulls last limit 1;
    if v_medicao_id is null then raise exception 'Medicao Final aprovada nao encontrada para esta obra'; end if;

    select count(*) into v_total_itens from public.medicao_itens where medicao_id = v_medicao_id;
    select count(*) into v_total_conferidos
      from public.medicao_itens mi
      join public.engenharia_conferencias ec on ec.medicao_item_id = mi.id
     where mi.medicao_id = v_medicao_id and ec.status = 'conferida';
    if v_total_itens = 0 or v_total_conferidos <> v_total_itens then
      raise exception 'Liberacao bloqueada: todas as pecas precisam estar conferidas pela Engenharia';
    end if;

    select id into v_producao_coluna_id from public.producao_colunas order by ordem asc limit 1;
    if v_producao_coluna_id is null then
      insert into public.producao_colunas (nome, ordem) values ('Medição final', 0)
      returning id into v_producao_coluna_id;
    end if;

    insert into public.producao_itens
      (titulo, descricao, coluna_id, orcamento_id, criado_por_id, criado_por_nome, atualizado_em)
    values
      (v_card.titulo, v_card.descricao, v_producao_coluna_id, v_card.orcamento_id,
       p_usuario_id, coalesce(nullif(p_usuario_nome, ''), 'Engenharia'), now())
    on conflict (orcamento_id) where orcamento_id is not null
    do update set titulo = excluded.titulo, descricao = excluded.descricao, atualizado_em = now();

    update public.setor_kanban_itens
       set coluna_id = p_coluna_id, atualizado_em = now(), liberado_producao_em = now(),
           liberado_producao_por_id = p_usuario_id,
           liberado_producao_por_nome = nullif(p_usuario_nome, '')
     where id = p_card_id;
  else
    update public.setor_kanban_itens
       set coluna_id = p_coluna_id, atualizado_em = now()
     where id = p_card_id;
  end if;
end;
$$;

grant execute on function public.fn_engenharia_liberar_para_producao(uuid, uuid, uuid, text) to anon, authenticated;
