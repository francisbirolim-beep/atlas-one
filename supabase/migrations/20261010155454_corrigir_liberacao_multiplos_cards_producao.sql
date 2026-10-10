-- A liberacao da Engenharia e exclusiva da Engenharia/Projeto.
-- Colunas do Kanban de Producao com nomes como "LIBERADO PARA PRODUZIR"
-- nao devem exigir conferencia de Engenharia ao simplesmente mover um card.
-- A aprovacao da Medicao Final na Producao segue seu proprio fluxo.
create or replace function public.fn_bloquear_liberacao_engenharia_incompleta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_destino_nome text;
  v_destino_setor text;
  v_medicao_id uuid;
  v_total_itens integer;
  v_total_conferidos integer;
begin
  if new.coluna_id is not distinct from old.coluna_id then
    return new;
  end if;

  select nome, setor_id
    into v_destino_nome, v_destino_setor
    from public.setor_kanban_colunas
   where id = new.coluna_id;

  -- Preserva rigorosamente o gate de Engenharia, mas sem afetar outros setores.
  if v_destino_setor is distinct from 'engenharia-projeto'
     or coalesce(lower(v_destino_nome), '') not like '%liberad%produ%' then
    return new;
  end if;

  if new.orcamento_id is null then
    raise exception 'Nao foi possivel identificar o orcamento da obra para liberar a Producao';
  end if;

  select mf.id
    into v_medicao_id
    from public.medicoes_finais mf
   where mf.orcamento_id = new.orcamento_id
     and mf.status_operacional = 'aprovado'
   order by mf.aprovado_em desc nulls last
   limit 1;

  if v_medicao_id is null then
    raise exception 'Medição Final aprovada nao encontrada para esta obra';
  end if;

  select count(*) into v_total_itens
    from public.medicao_itens mi
   where mi.medicao_id = v_medicao_id;

  select count(*) into v_total_conferidos
    from public.medicao_itens mi
    join public.engenharia_conferencias ec on ec.medicao_item_id = mi.id
   where mi.medicao_id = v_medicao_id
     and ec.status = 'conferida';

  if v_total_itens = 0 or v_total_conferidos <> v_total_itens then
    raise exception 'Liberacao bloqueada: todas as pecas precisam estar conferidas pela Engenharia';
  end if;

  return new;
end;
$$;