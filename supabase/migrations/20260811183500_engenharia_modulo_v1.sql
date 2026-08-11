-- Fase 2 da Engenharia: ativa rota propria e padroniza o fluxo tecnico.
-- Reaproveita as tabelas de setor existentes para nao duplicar fonte de dados.

do $$
declare
  v_setor_id text;
  v_coluna_inicial uuid;
begin
  select s.id
    into v_setor_id
    from public.setores s
   where lower(s.nome) like '%engenharia%'
   order by s.ordem asc
   limit 1;

  if v_setor_id is null then
    raise exception 'Setor Engenharia não encontrado no cadastro de setores';
  end if;

  update public.setores
     set ativo = true,
         rota = '/engenharia'
   where id = v_setor_id;

  select c.id
    into v_coluna_inicial
    from public.setor_kanban_colunas c
   where c.setor_id = v_setor_id
   order by c.ordem asc, c.created_at asc
   limit 1;

  if not exists (
    select 1 from public.setor_kanban_colunas
    where setor_id = v_setor_id and lower(nome) = lower('Recebidas')
  ) then
    if v_coluna_inicial is not null then
      update public.setor_kanban_colunas
         set nome = 'Recebidas', ordem = 0
       where id = v_coluna_inicial;
    else
      insert into public.setor_kanban_colunas (setor_id, nome, ordem)
      values (v_setor_id, 'Recebidas', 0);
    end if;
  end if;

  if not exists (
    select 1 from public.setor_kanban_colunas
    where setor_id = v_setor_id and lower(nome) = lower('Conferência técnica')
  ) then
    insert into public.setor_kanban_colunas (setor_id, nome, ordem)
    values (v_setor_id, 'Conferência técnica', 1);
  end if;

  if not exists (
    select 1 from public.setor_kanban_colunas
    where setor_id = v_setor_id and lower(nome) = lower('Em desenvolvimento')
  ) then
    insert into public.setor_kanban_colunas (setor_id, nome, ordem)
    values (v_setor_id, 'Em desenvolvimento', 2);
  end if;

  if not exists (
    select 1 from public.setor_kanban_colunas
    where setor_id = v_setor_id and lower(nome) = lower('Liberado para produção')
  ) then
    insert into public.setor_kanban_colunas (setor_id, nome, ordem)
    values (v_setor_id, 'Liberado para produção', 3);
  end if;
end $$;
