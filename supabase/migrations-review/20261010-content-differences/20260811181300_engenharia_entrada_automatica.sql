-- Entrada automática na Engenharia ao aprovar a Medição Final.
-- A automação roda no mesmo commit da aprovação: se não conseguir criar/atualizar
-- o card da Engenharia, a aprovação inteira falha e pode ser tentada novamente.

create or replace function public.fn_medicao_aprovada_para_engenharia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setor_id text;
  v_coluna_id uuid;
  v_item_existente uuid;
  v_itens text;
  v_descricao text;
begin
  if new.status_operacional is distinct from 'aprovado'
     or old.status_operacional is not distinct from 'aprovado' then
    return new;
  end if;

  select s.id
    into v_setor_id
    from public.setores s
   where lower(s.nome) like '%engenharia%'
   order by s.ordem asc
   limit 1;

  if v_setor_id is null then
    raise exception 'Setor Engenharia não encontrado no cadastro de setores';
  end if;

  select c.id
    into v_coluna_id
    from public.setor_kanban_colunas c
   where c.setor_id = v_setor_id
   order by c.ordem asc
   limit 1;

  if v_coluna_id is null then
    insert into public.setor_kanban_colunas (setor_id, nome, ordem)
    values (v_setor_id, 'A Fazer', 0)
    returning id into v_coluna_id;
  end if;

  select string_agg(
    format(
      '%s. %s\nTipo: %s\nQuantidade: %s\nLarguras mm (baixo / meio / cima): %s / %s / %s\nAlturas mm (direita / meio / esquerda): %s / %s / %s',
      coalesce(mi.ordem, 0) + 1,
      coalesce(nullif(trim(mi.descricao), ''), nullif(trim(mi.tipo_outro_texto), ''), mi.tipo_esquadria, 'Peça'),
      coalesce(mi.tipo_esquadria, '?'),
      greatest(coalesce(mi.quantidade, 1), 1),
      coalesce(mi.largura_baixo_mm::text, '?'),
      coalesce(mi.largura_meio_mm::text, '?'),
      coalesce(mi.largura_cima_mm::text, '?'),
      coalesce(mi.altura_direita_mm::text, '?'),
      coalesce(mi.altura_meio_mm::text, '?'),
      coalesce(mi.altura_esquerda_mm::text, '?')
    ),
    E'\n\n'
    order by mi.ordem asc
  )
  into v_itens
  from public.medicao_itens mi
  where mi.medicao_id = new.id;

  v_descricao := concat_ws(
    E'\n',
    'MEDIÇÃO FINAL APROVADA',
    'Cliente: ' || coalesce(new.cliente_nome, 'Não informado'),
    case
      when concat_ws(' · ', nullif(new.endereco, ''), nullif(new.bairro, ''), nullif(new.cidade, '')) <> ''
      then 'Local: ' || concat_ws(' · ', nullif(new.endereco, ''), nullif(new.bairro, ''), nullif(new.cidade, ''))
      else null
    end,
    'Medição: ' || new.id::text,
    case when new.orcamento_id is not null then 'Orçamento: ' || new.orcamento_id::text else null end,
    case when new.aprovado_por_nome is not null then 'Aprovado por: ' || new.aprovado_por_nome else null end,
    '',
    'PEÇAS APROVADAS',
    coalesce(v_itens, 'Nenhuma peça encontrada')
  );

  if new.orcamento_id is not null then
    select ski.id
      into v_item_existente
      from public.setor_kanban_itens ski
      join public.setor_kanban_colunas skc on skc.id = ski.coluna_id
     where skc.setor_id = v_setor_id
       and ski.orcamento_id = new.orcamento_id
     order by ski.created_at asc
     limit 1;
  else
    select ski.id
      into v_item_existente
      from public.setor_kanban_itens ski
      join public.setor_kanban_colunas skc on skc.id = ski.coluna_id
     where skc.setor_id = v_setor_id
       and ski.descricao like '%' || new.id::text || '%'
     order by ski.created_at asc
     limit 1;
  end if;

  if v_item_existente is not null then
    update public.setor_kanban_itens
       set titulo = new.cliente_nome,
           descricao = v_descricao,
           coluna_id = v_coluna_id,
           atualizado_em = now()
     where id = v_item_existente;
  else
    insert into public.setor_kanban_itens (
      titulo,
      descricao,
      coluna_id,
      criado_por_id,
      criado_por_nome,
      orcamento_id
    ) values (
      new.cliente_nome,
      v_descricao,
      v_coluna_id,
      new.aprovado_por_id,
      coalesce(new.aprovado_por_nome, 'Automação Medição Final'),
      new.orcamento_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_medicao_aprovada_para_engenharia on public.medicoes_finais;
create trigger trg_medicao_aprovada_para_engenharia
after update of status_operacional on public.medicoes_finais
for each row
when (new.status_operacional = 'aprovado')
execute function public.fn_medicao_aprovada_para_engenharia();
