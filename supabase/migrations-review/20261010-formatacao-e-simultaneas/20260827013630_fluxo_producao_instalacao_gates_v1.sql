-- Atlas One — gates Medição/Materiais -> Produção -> Instalação e fechamento da revisão

create or replace function public.fn_registrar_revisao_venda_v1(
  p_venda_obra_id uuid,
  p_justificativa text,
  p_depois jsonb,
  p_impacto_valor numeric default null,
  p_impacto_custo numeric default null,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_venda public.vendas_obras%rowtype;
  v_antes jsonb;
  v_depois jsonb;
  v_versao integer;
  v_id uuid;
  v_projeto_conferido boolean;
begin
  if length(trim(coalesce(p_justificativa,'')))<3 then raise exception 'Justificativa obrigatória para alteração pós-venda'; end if;
  if p_depois is null or jsonb_typeof(p_depois)<>'object' then raise exception 'Estado revisado inválido'; end if;
  select * into v_venda from public.vendas_obras where id=p_venda_obra_id for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  v_antes:=public.fn_venda_estado_atual_v1(p_venda_obra_id);
  select coalesce(max(versao),v_venda.versao)+1 into v_versao from public.venda_obra_revisoes where venda_obra_id=p_venda_obra_id;
  v_depois:=p_depois || jsonb_build_object('versao',v_versao);
  insert into public.venda_obra_revisoes(venda_obra_id,versao,tipo,justificativa,antes,depois,impacto_valor,impacto_custo,criado_por_id,criado_por_nome)
  values(p_venda_obra_id,v_versao,'ajuste',p_justificativa,v_antes,v_depois,p_impacto_valor,p_impacto_custo,p_usuario_id,p_usuario_nome)
  returning id into v_id;
  update public.vendas_obras set versao=v_versao,updated_at=now() where id=p_venda_obra_id;

  select exists(
    select 1 from public.setor_kanban_itens ski join public.setor_kanban_colunas c on c.id=ski.coluna_id
    where ski.orcamento_id=v_venda.orcamento_id and c.setor_id='engenharia-projeto' and lower(c.nome)='projeto conferido'
  ) into v_projeto_conferido;
  if v_projeto_conferido then perform public.fn_criar_ordens_producao_v1(v_venda.orcamento_id,p_usuario_id,p_usuario_nome); end if;
  return v_id;
end;
$$;
revoke execute on function public.fn_registrar_revisao_venda_v1(uuid,text,jsonb,numeric,numeric,uuid,text) from public,anon;
grant execute on function public.fn_registrar_revisao_venda_v1(uuid,text,jsonb,numeric,numeric,uuid,text) to authenticated;

create or replace function public.fn_tentar_liberar_producao_v1(p_orcamento_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_medicao_ok boolean;
  v_setores integer;
  v_todos_liberados boolean;
begin
  if p_orcamento_id is null then return false; end if;
  select exists(select 1 from public.medicoes_finais m where m.orcamento_id=p_orcamento_id and m.status_operacional='aprovado') into v_medicao_ok;
  if not v_medicao_ok then return false; end if;

  select count(distinct c.setor_id),coalesce(bool_and(lower(c.nome)='liberado'),false)
    into v_setores,v_todos_liberados
    from public.setor_kanban_itens i
    join public.setor_kanban_colunas c on c.id=i.coluna_id
   where i.orcamento_id=p_orcamento_id
     and c.setor_id in ('compras-perfis','compras-acessorios','compras-outros');

  if v_setores<>3 or not v_todos_liberados then return false; end if;

  update public.ordens_producao
     set bloqueada=false,
         bloqueio_motivo=null,
         status=case when status='aguardando' then 'liberada' else status end,
         updated_at=now()
   where orcamento_id=p_orcamento_id
     and tipo_producao='esquadria'
     and status not in ('concluida','cancelada');
  return true;
end;
$$;
revoke execute on function public.fn_tentar_liberar_producao_v1(uuid) from public,anon,authenticated;

create or replace function public.fn_tentar_liberar_instalacao_v1(
  p_orcamento_id uuid,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
) returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_total integer;
  v_pendentes integer;
  v_vidro_ok boolean;
begin
  if p_orcamento_id is null then return false; end if;
  select count(*),count(*) filter(where status<>'concluida')
    into v_total,v_pendentes
    from public.ordens_producao
   where orcamento_id=p_orcamento_id and status<>'cancelada';
  if v_total=0 or v_pendentes>0 then return false; end if;

  select exists(
    select 1 from public.setor_kanban_itens i
    join public.setor_kanban_colunas c on c.id=i.coluna_id
    where i.orcamento_id=p_orcamento_id and c.setor_id='compras-vidros' and lower(c.nome)='liberado'
  ) into v_vidro_ok;
  if not v_vidro_ok then return false; end if;

  perform public.fn_workflow_disparar_evento_v1('producao_concluida',p_orcamento_id,'ordens_producao',p_usuario_id,coalesce(p_usuario_nome,'Automação Produção'));
  return true;
end;
$$;
revoke execute on function public.fn_tentar_liberar_instalacao_v1(uuid,uuid,text) from public,anon,authenticated;

update public.workflow_automacoes
   set ativo=true,
       mensagem_template='Produção concluída e Vidros liberados para {cliente}. Instalação liberada para programação.',
       updated_at=now()
 where evento_chave='producao_concluida' and acao_tipo='criar_card_setor' and destino_setor_id='instalacao';

insert into public.setor_kanban_colunas(setor_id,nome,ordem)
select 'instalacao',x.nome,x.ordem
from (values ('Agendada',1),('Em instalação',2),('Concluída',3)) as x(nome,ordem)
where not exists(select 1 from public.setor_kanban_colunas c where c.setor_id='instalacao' and lower(c.nome)=lower(x.nome));

create or replace function public.fn_gates_card_material_v1()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_setor text; v_nome text;
begin
  if new.coluna_id is not distinct from old.coluna_id then return new; end if;
  select setor_id,nome into v_setor,v_nome from public.setor_kanban_colunas where id=new.coluna_id;
  if lower(coalesce(v_nome,''))<>'liberado' or new.orcamento_id is null then return new; end if;
  if v_setor in ('compras-perfis','compras-acessorios','compras-outros') then
    perform public.fn_tentar_liberar_producao_v1(new.orcamento_id);
  elsif v_setor='compras-vidros' then
    perform public.fn_tentar_liberar_instalacao_v1(new.orcamento_id,new.atualizado_por_id,new.atualizado_por_nome);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_gates_card_material on public.setor_kanban_itens;
create trigger trg_gates_card_material after update of coluna_id on public.setor_kanban_itens for each row execute function public.fn_gates_card_material_v1();

create or replace function public.fn_gate_medicao_liberar_producao_v1()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.status_operacional is not distinct from 'aprovado' and old.status_operacional is distinct from 'aprovado' and new.orcamento_id is not null then
    perform public.fn_tentar_liberar_producao_v1(new.orcamento_id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_gate_medicao_liberar_producao on public.medicoes_finais;
create trigger trg_gate_medicao_liberar_producao after update of status_operacional on public.medicoes_finais for each row execute function public.fn_gate_medicao_liberar_producao_v1();

create or replace function public.fn_sync_card_producao_ordens_v1()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_card uuid:=coalesce(new.setor_card_id,old.setor_card_id);
  v_total integer;
  v_concluidas integer;
  v_conf integer;
  v_em integer;
  v_coluna uuid;
  v_nome text;
  v_orc uuid:=coalesce(new.orcamento_id,old.orcamento_id);
  v_user uuid:=coalesce(new.criado_por_id,old.criado_por_id);
  v_user_nome text:=coalesce(new.criado_por_nome,old.criado_por_nome,'Automação Produção');
begin
  if v_card is not null then
    select count(*) filter(where status<>'cancelada'),
           count(*) filter(where status='concluida'),
           count(*) filter(where status='conferencia'),
           count(*) filter(where status='em_producao')
      into v_total,v_concluidas,v_conf,v_em
      from public.ordens_producao where setor_card_id=v_card;
    v_nome:=case when v_total>0 and v_concluidas=v_total then 'Concluído' when v_conf>0 then 'Conferência' when v_em>0 then 'Em produção' else 'Aguardando produção' end;
    select id into v_coluna from public.setor_kanban_colunas where setor_id='producao' and lower(nome)=lower(v_nome) order by ordem limit 1;
    if v_coluna is not null then update public.setor_kanban_itens set coluna_id=v_coluna,atualizado_em=now() where id=v_card and coluna_id is distinct from v_coluna; end if;
  end if;
  if v_orc is not null then perform public.fn_tentar_liberar_instalacao_v1(v_orc,v_user,v_user_nome); end if;
  return coalesce(new,old);
end;
$$;
drop trigger if exists trg_sync_card_producao_ordens_ins on public.ordens_producao;
drop trigger if exists trg_sync_card_producao_ordens_upd on public.ordens_producao;
create trigger trg_sync_card_producao_ordens_ins after insert on public.ordens_producao for each row execute function public.fn_sync_card_producao_ordens_v1();
create trigger trg_sync_card_producao_ordens_upd after update of status,bloqueada,setor_card_id on public.ordens_producao for each row execute function public.fn_sync_card_producao_ordens_v1();

create or replace function public.fn_validar_movimento_card_producao_v1()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_setor text;
  v_destino text;
  v_total integer;
  v_concluidas integer;
  v_conf integer;
  v_em integer;
  v_esperado text;
begin
  if new.coluna_id is not distinct from old.coluna_id then return new; end if;
  select setor_id,nome into v_setor,v_destino from public.setor_kanban_colunas where id=new.coluna_id;
  if v_setor<>'producao' then return new; end if;
  if not exists(select 1 from public.ordens_producao where setor_card_id=new.id) then return new; end if;
  select count(*) filter(where status<>'cancelada'),count(*) filter(where status='concluida'),count(*) filter(where status='conferencia'),count(*) filter(where status='em_producao')
    into v_total,v_concluidas,v_conf,v_em from public.ordens_producao where setor_card_id=new.id;
  v_esperado:=case when v_total>0 and v_concluidas=v_total then 'concluído' when v_conf>0 then 'conferência' when v_em>0 then 'em produção' else 'aguardando produção' end;
  if lower(v_destino)<>v_esperado then raise exception 'O card de Produção acompanha as Ordens de Produção. Atualize as ordens dentro do card.'; end if;
  return new;
end;
$$;
drop trigger if exists trg_validar_movimento_card_producao on public.setor_kanban_itens;
create trigger trg_validar_movimento_card_producao before update of coluna_id on public.setor_kanban_itens for each row execute function public.fn_validar_movimento_card_producao_v1();

create or replace function public.fn_instalacao_concluida_v1()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_setor text; v_nome text;
begin
  if new.coluna_id is not distinct from old.coluna_id then return new; end if;
  select setor_id,nome into v_setor,v_nome from public.setor_kanban_colunas where id=new.coluna_id;
  if v_setor='instalacao' and lower(v_nome) in ('concluída','concluida','concluído','concluido') then
    if new.obra_id is not null then update public.obras set status='concluida',updated_at=now() where id=new.obra_id; end if;
    if new.orcamento_id is not null then perform public.fn_workflow_disparar_evento_v1('instalacao_concluida',new.orcamento_id,new.id::text,new.atualizado_por_id,new.atualizado_por_nome); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_instalacao_concluida on public.setor_kanban_itens;
create trigger trg_instalacao_concluida after update of coluna_id on public.setor_kanban_itens for each row execute function public.fn_instalacao_concluida_v1();
