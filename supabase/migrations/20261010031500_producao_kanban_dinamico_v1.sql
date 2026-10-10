-- Produção: Kanban livre e descrições editáveis por etapa.
-- O status técnico continua em ordens_producao; a posição do card passa a representar
-- somente a etapa operacional configurável pelo usuário.
alter table public.setor_kanban_colunas
  add column if not exists descricao text;

update public.setor_kanban_colunas
set descricao = case lower(nome)
  when 'liberar produção' then 'Conferir a Medição Final e liberar o processo.'
  when 'em produção' then 'Etapa operacional após a liberação da Medição Final.'
  when 'conferência' then 'Conferência operacional antes da conclusão.'
  when 'concluído' then 'Processos finalizados nesta etapa.'
  else descricao
end
where setor_id = 'producao'
  and descricao is null;

create or replace function public.fn_validar_movimento_card_producao_v1()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- O Kanban de Produção é configurável. O status técnico permanece nas
  -- ordens_producao e não deve impedir o usuário de mover o processo
  -- por etapas operacionais personalizadas.
  return new;
end;
$function$;

create or replace function public.fn_sync_card_producao_ordens_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_orc uuid := coalesce(new.orcamento_id, old.orcamento_id);
  v_user uuid := coalesce(new.criado_por_id, old.criado_por_id);
  v_user_nome text := coalesce(new.criado_por_nome, old.criado_por_nome, 'Automação Produção');
begin
  -- A alteração de status da OP não reposiciona mais o card do Kanban.
  -- Mantemos apenas o gate de instalação que depende do estado técnico real.
  if v_orc is not null then
    perform public.fn_tentar_liberar_instalacao_v1(v_orc, v_user, v_user_nome);
  end if;
  return coalesce(new, old);
end;
$function$;