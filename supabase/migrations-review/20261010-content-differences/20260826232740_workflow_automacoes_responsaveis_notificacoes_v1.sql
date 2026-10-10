-- Atlas One — motor de workflow entre setores V1
-- Configura gatilho -> destino -> responsável -> tarefa -> notificação, com auditoria/idempotência.

create table if not exists public.workflow_automacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  evento_chave text not null,
  acao_tipo text not null default 'criar_card_setor',
  destino_setor_id text references public.setores(id) on delete set null,
  destino_coluna_id uuid references public.setor_kanban_colunas(id) on delete set null,
  responsavel_usuario_id uuid references public.usuarios(id) on delete set null,
  notificar_responsavel boolean not null default true,
  notificar_usuario_ids uuid[] not null default '{}'::uuid[],
  criar_tarefa boolean not null default false,
  prazo_horas integer,
  prioridade_tarefa text not null default 'normal',
  titulo_tarefa_template text,
  mensagem_template text,
  evitar_duplicidade boolean not null default true,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_automacoes_acao_check check (acao_tipo in ('criar_card_setor','financeiro_venda','criar_medicao_final','mee_pos_medicao','reservado')),
  constraint workflow_automacoes_prioridade_check check (prioridade_tarefa in ('baixa','normal','alta','urgente')),
  constraint workflow_automacoes_prazo_check check (prazo_horas is null or prazo_horas >= 0)
);

create unique index if not exists workflow_automacoes_regra_unica_idx
  on public.workflow_automacoes(evento_chave, acao_tipo, coalesce(destino_setor_id, ''));
create index if not exists workflow_automacoes_evento_idx
  on public.workflow_automacoes(evento_chave, ativo, ordem);

create table if not exists public.workflow_execucoes (
  id uuid primary key default gen_random_uuid(),
  automacao_id uuid not null references public.workflow_automacoes(id) on delete cascade,
  evento_chave text not null,
  orcamento_id uuid references public.orcamentos(id) on delete cascade,
  origem_id text,
  destino_card_id uuid references public.setor_kanban_itens(id) on delete set null,
  tarefa_id uuid references public.tarefas(id) on delete set null,
  status text not null default 'executado',
  detalhe text,
  executado_por_id uuid references public.usuarios(id) on delete set null,
  executado_por_nome text,
  created_at timestamptz not null default now(),
  constraint workflow_execucoes_status_check check (status in ('executado','ignorado','erro'))
);
create unique index if not exists workflow_execucoes_idempotencia_idx
  on public.workflow_execucoes(automacao_id, orcamento_id)
  where orcamento_id is not null;
create index if not exists workflow_execucoes_orcamento_idx
  on public.workflow_execucoes(orcamento_id, created_at desc);

alter table public.setor_kanban_itens
  add column if not exists responsavel_id uuid references public.usuarios(id) on delete set null,
  add column if not exists responsavel_nome text,
  add column if not exists workflow_automacao_id uuid references public.workflow_automacoes(id) on delete set null;

alter table public.tarefas
  add column if not exists workflow_automacao_id uuid references public.workflow_automacoes(id) on delete set null,
  add column if not exists orcamento_id uuid references public.orcamentos(id) on delete cascade,
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null,
  add column if not exists obra_id uuid references public.obras(id) on delete set null;

create unique index if not exists tarefas_workflow_idempotencia_idx
  on public.tarefas(workflow_automacao_id, orcamento_id, usuario_id)
  where workflow_automacao_id is not null and orcamento_id is not null;

insert into public.setores(id, nome, grupo, ordem, ativo, rota, descricao)
values ('workflow-automacoes', 'Automações do Fluxo', 'Sistema', 95, true, '/configuracoes/automacoes-fluxo', 'Motor de gatilhos, responsáveis, tarefas e notificações entre os setores do Atlas.')
on conflict (id) do update set nome=excluded.nome,grupo=excluded.grupo,ordem=excluded.ordem,ativo=true,rota=excluded.rota,descricao=excluded.descricao;

insert into public.setores(id, nome, grupo, ordem, ativo, rota, descricao)
values ('producao', 'Produção', 'Operações', 60, false, null, 'Produção das peças da obra; gates serão configurados no workflow.')
on conflict (id) do nothing;

insert into public.setor_kanban_colunas(setor_id, nome, ordem)
select 'producao', x.nome, x.ordem
from (values ('Aguardando produção',0),('Em produção',1),('Conferência',2),('Concluído',3)) as x(nome,ordem)
where not exists (select 1 from public.setor_kanban_colunas c where c.setor_id='producao' and lower(c.nome)=lower(x.nome));

update public.automacoes_setor set ativo=false where setor_id='financeiro';

insert into public.workflow_automacoes(nome,evento_chave,acao_tipo,destino_setor_id,destino_coluna_id,responsavel_usuario_id,notificar_responsavel,criar_tarefa,titulo_tarefa_template,mensagem_template,ativo,ordem)
select 'Venda confirmada → Financeiro','venda_confirmada','financeiro_venda','financeiro',(select id from public.setor_kanban_colunas where setor_id='financeiro' order by ordem limit 1),(select id from public.usuarios where lower(nome)='gabrielle' or lower(email)='contato@esquadrifacio.com.br' order by case when lower(nome)='gabrielle' then 0 else 1 end limit 1),true,true,'Conferir financeiro — {cliente}','Nova venda confirmada: {cliente} — Orçamento #{numero} — R$ {valor}. Conferir condição de pagamento e programar o financeiro.',true,10
on conflict (evento_chave, acao_tipo, (coalesce(destino_setor_id, ''))) do update set nome=excluded.nome,destino_coluna_id=excluded.destino_coluna_id,responsavel_usuario_id=coalesce(public.workflow_automacoes.responsavel_usuario_id, excluded.responsavel_usuario_id),notificar_responsavel=true,criar_tarefa=true,titulo_tarefa_template=excluded.titulo_tarefa_template,mensagem_template=excluded.mensagem_template,ativo=true,ordem=excluded.ordem;

insert into public.workflow_automacoes(nome,evento_chave,acao_tipo,destino_setor_id,destino_coluna_id,notificar_responsavel,criar_tarefa,mensagem_template,ativo,ordem)
values
('Venda confirmada → Conferir Projeto','venda_confirmada','criar_card_setor','engenharia-projeto',(select id from public.setor_kanban_colunas where setor_id='engenharia-projeto' order by ordem limit 1),true,false,'Nova venda de {cliente}. Conferir tipologia, montagem, perfis, acessórios e definições técnicas antes de liberar as próximas etapas.',true,20),
('Projeto conferido → Medição Final','projeto_conferido','criar_medicao_final',null,null,true,false,'Projeto de {cliente} conferido. Medição Final liberada.',true,10),
('Projeto conferido → Perfis','projeto_conferido','criar_card_setor','compras-perfis',(select id from public.setor_kanban_colunas where setor_id='compras-perfis' order by ordem limit 1),true,false,'Projeto de {cliente} conferido. Levantar/acompanhar necessidade de perfis.',true,20),
('Projeto conferido → Acessórios','projeto_conferido','criar_card_setor','compras-acessorios',(select id from public.setor_kanban_colunas where setor_id='compras-acessorios' order by ordem limit 1),true,false,'Projeto de {cliente} conferido. Levantar/acompanhar necessidade de acessórios.',true,30),
('Projeto conferido → Outros materiais','projeto_conferido','criar_card_setor','compras-outros',(select id from public.setor_kanban_colunas where setor_id='compras-outros' order by ordem limit 1),true,false,'Projeto de {cliente} conferido. Levantar/acompanhar outros materiais necessários.',true,40),
('Medição aprovada → Vidros','medicao_aprovada','criar_card_setor','compras-vidros',(select id from public.setor_kanban_colunas where setor_id='compras-vidros' order by ordem limit 1),true,false,'Medição Final aprovada para {cliente}. Vidros liberados para detalhamento e compra.',true,10),
('Medição aprovada → MEE','medicao_aprovada','mee_pos_medicao','mee',(select id from public.setor_kanban_colunas where setor_id='mee' order by ordem limit 1),true,false,'Medição Final aprovada para {cliente}. Conferir/desenvolver engenharia técnica final.',true,20),
('Materiais liberados → Produção','materiais_liberados','criar_card_setor','producao',(select id from public.setor_kanban_colunas where setor_id='producao' order by ordem limit 1),true,false,'Materiais liberados para {cliente}. Produção aguardando definição final do gate.',false,10),
('Produção concluída → Instalação','producao_concluida','criar_card_setor','instalacao',(select id from public.setor_kanban_colunas where setor_id='instalacao' order by ordem limit 1),true,false,'Produção concluída para {cliente}. Instalação aguardando definição de agendamento/liberação.',false,10)
on conflict (evento_chave, acao_tipo, (coalesce(destino_setor_id, ''))) do nothing;

alter table public.workflow_automacoes enable row level security;
drop policy if exists workflow_automacoes_select_auth on public.workflow_automacoes;
drop policy if exists workflow_automacoes_master_insert on public.workflow_automacoes;
drop policy if exists workflow_automacoes_master_update on public.workflow_automacoes;
drop policy if exists workflow_automacoes_master_delete on public.workflow_automacoes;
create policy workflow_automacoes_select_auth on public.workflow_automacoes for select to authenticated using (auth.uid() is not null);
create policy workflow_automacoes_master_insert on public.workflow_automacoes for insert to authenticated with check (exists(select 1 from public.usuarios u where u.id=auth.uid() and u.role='master'));
create policy workflow_automacoes_master_update on public.workflow_automacoes for update to authenticated using (exists(select 1 from public.usuarios u where u.id=auth.uid() and u.role='master')) with check (exists(select 1 from public.usuarios u where u.id=auth.uid() and u.role='master'));
create policy workflow_automacoes_master_delete on public.workflow_automacoes for delete to authenticated using (exists(select 1 from public.usuarios u where u.id=auth.uid() and u.role='master'));
grant select,insert,update,delete on public.workflow_automacoes to authenticated;

alter table public.workflow_execucoes enable row level security;
drop policy if exists workflow_execucoes_select_auth on public.workflow_execucoes;
create policy workflow_execucoes_select_auth on public.workflow_execucoes for select to authenticated using (auth.uid() is not null);
grant select on public.workflow_execucoes to authenticated;

create or replace function public.workflow_touch_updated_at_v1() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_workflow_automacoes_updated_at on public.workflow_automacoes;
create trigger trg_workflow_automacoes_updated_at before update on public.workflow_automacoes for each row execute function public.workflow_touch_updated_at_v1();

create or replace function public.fn_workflow_renderizar_v1(p_template text,p_orcamento_id uuid,p_evento text) returns text language plpgsql security definer set search_path=public as $$
declare v_orc public.orcamentos%rowtype; v_obra_nome text; v_text text;
begin
  select * into v_orc from public.orcamentos where id=p_orcamento_id;
  if not found then return coalesce(p_template,''); end if;
  if v_orc.obra_id is not null then select nome into v_obra_nome from public.obras where id=v_orc.obra_id; end if;
  v_text:=coalesce(p_template,'');
  v_text:=replace(v_text,'{cliente}',coalesce(v_orc.cliente_nome,'Cliente'));
  v_text:=replace(v_text,'{numero}',coalesce(v_orc.numero::text,'-'));
  v_text:=replace(v_text,'{valor}',to_char(coalesce(v_orc.valor_estimado,0),'FM999999990D00'));
  v_text:=replace(v_text,'{obra}',coalesce(v_obra_nome,'Sem obra definida'));
  v_text:=replace(v_text,'{evento}',coalesce(p_evento,''));
  return v_text;
end; $$;
revoke execute on function public.fn_workflow_renderizar_v1(text,uuid,text) from public,anon;
grant execute on function public.fn_workflow_renderizar_v1(text,uuid,text) to authenticated;

create or replace function public.fn_workflow_coluna_tarefa_v1(p_usuario_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  select id into v_id from public.tarefa_colunas where usuario_id=p_usuario_id and lower(nome)='a fazer' order by created_at asc limit 1;
  if v_id is null then insert into public.tarefa_colunas(usuario_id,nome,ordem) values(p_usuario_id,'A fazer',0) returning id into v_id; end if;
  return v_id;
end; $$;
revoke execute on function public.fn_workflow_coluna_tarefa_v1(uuid) from public,anon;

create or replace function public.fn_workflow_executar_automacao_v1(p_automacao_id uuid,p_orcamento_id uuid,p_origem_id text default null,p_usuario_id uuid default null,p_usuario_nome text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_a public.workflow_automacoes%rowtype; v_orc public.orcamentos%rowtype; v_card_id uuid; v_tarefa_id uuid; v_tarefa_coluna uuid; v_texto text; v_titulo_tarefa text; v_href text; v_recipientes uuid[]; v_destinatario uuid; v_resp_nome text; v_existente uuid;
begin
  select * into v_a from public.workflow_automacoes where id=p_automacao_id and ativo=true; if not found then return null; end if;
  select * into v_orc from public.orcamentos where id=p_orcamento_id; if not found then return null; end if;
  if v_a.evitar_duplicidade then select destino_card_id into v_existente from public.workflow_execucoes where automacao_id=v_a.id and orcamento_id=p_orcamento_id limit 1; if found then return v_existente; end if; end if;
  v_texto:=public.fn_workflow_renderizar_v1(coalesce(v_a.mensagem_template,v_a.nome),p_orcamento_id,v_a.evento_chave);
  v_titulo_tarefa:=public.fn_workflow_renderizar_v1(coalesce(v_a.titulo_tarefa_template,v_a.nome),p_orcamento_id,v_a.evento_chave);
  if v_a.responsavel_usuario_id is not null then select nome into v_resp_nome from public.usuarios where id=v_a.responsavel_usuario_id; end if;
  if v_a.acao_tipo in ('criar_card_setor','financeiro_venda') and v_a.destino_setor_id is not null then
    select ski.id into v_card_id from public.setor_kanban_itens ski join public.setor_kanban_colunas c on c.id=ski.coluna_id where c.setor_id=v_a.destino_setor_id and ski.orcamento_id=p_orcamento_id order by ski.created_at limit 1;
    if v_card_id is null then
      insert into public.setor_kanban_itens(titulo,descricao,coluna_id,criado_por_id,criado_por_nome,orcamento_id,cliente_id,obra_id,responsavel_id,responsavel_nome,workflow_automacao_id,atualizado_por_id,atualizado_por_nome)
      values(coalesce(v_orc.cliente_nome,'Cliente'),v_texto,v_a.destino_coluna_id,p_usuario_id,coalesce(p_usuario_nome,'Automação Atlas'),p_orcamento_id,v_orc.cliente_id,v_orc.obra_id,v_a.responsavel_usuario_id,v_resp_nome,v_a.id,p_usuario_id,p_usuario_nome) returning id into v_card_id;
    else
      update public.setor_kanban_itens set cliente_id=coalesce(cliente_id,v_orc.cliente_id),obra_id=coalesce(obra_id,v_orc.obra_id),responsavel_id=coalesce(v_a.responsavel_usuario_id,responsavel_id),responsavel_nome=coalesce(v_resp_nome,responsavel_nome),workflow_automacao_id=coalesce(workflow_automacao_id,v_a.id),atualizado_em=now() where id=v_card_id;
    end if;
  elsif v_a.acao_tipo='mee_pos_medicao' and v_a.destino_setor_id is not null then
    select ski.id into v_card_id from public.setor_kanban_itens ski join public.setor_kanban_colunas c on c.id=ski.coluna_id where c.setor_id=v_a.destino_setor_id and ski.orcamento_id=p_orcamento_id order by ski.created_at limit 1;
    if v_card_id is null then return null; end if;
    update public.setor_kanban_itens set responsavel_id=v_a.responsavel_usuario_id,responsavel_nome=v_resp_nome,workflow_automacao_id=v_a.id,atualizado_em=now() where id=v_card_id;
  end if;
  if v_a.criar_tarefa and v_a.responsavel_usuario_id is not null then
    select id into v_tarefa_id from public.tarefas where workflow_automacao_id=v_a.id and orcamento_id=p_orcamento_id and usuario_id=v_a.responsavel_usuario_id limit 1;
    if v_tarefa_id is null then
      v_tarefa_coluna:=public.fn_workflow_coluna_tarefa_v1(v_a.responsavel_usuario_id);
      insert into public.tarefas(usuario_id,coluna_id,titulo,descricao,data_hora,solicitante_id,solicitante_nome,atribuida_em,prioridade,workflow_automacao_id,orcamento_id,cliente_id,obra_id)
      values(v_a.responsavel_usuario_id,v_tarefa_coluna,v_titulo_tarefa,v_texto,case when v_a.prazo_horas is null then null else now()+make_interval(hours=>v_a.prazo_horas) end,p_usuario_id,p_usuario_nome,now(),v_a.prioridade_tarefa,v_a.id,p_orcamento_id,v_orc.cliente_id,v_orc.obra_id) returning id into v_tarefa_id;
    end if;
  end if;
  if v_a.acao_tipo='financeiro_venda' and v_orc.cliente_id is not null then v_href:='/clientes/'||v_orc.cliente_id::text||'/central?aba=financeiro'; elsif v_a.acao_tipo='criar_medicao_final' then v_href:='/producao/medicao-final'; elsif v_a.destino_setor_id is not null then v_href:='/setor/'||v_a.destino_setor_id; elsif v_orc.cliente_id is not null then v_href:='/clientes/'||v_orc.cliente_id::text||'/central?aba=andamento'; else v_href:='/'; end if;
  v_recipientes:=coalesce(v_a.notificar_usuario_ids,'{}'::uuid[]); if v_a.notificar_responsavel and v_a.responsavel_usuario_id is not null and not(v_a.responsavel_usuario_id=any(v_recipientes)) then v_recipientes:=array_append(v_recipientes,v_a.responsavel_usuario_id); end if;
  foreach v_destinatario in array v_recipientes loop if v_destinatario is not null then insert into public.notificacoes(usuario_id,categoria,tipo,titulo,mensagem,href,origem_tipo,origem_id,criado_por_id,criado_por_nome) values(v_destinatario,'operacao','workflow',v_a.nome,v_texto,v_href,'workflow',v_a.id::text||':'||p_orcamento_id::text,p_usuario_id,p_usuario_nome) on conflict (usuario_id,origem_tipo,origem_id) where origem_tipo is not null and origem_id is not null do nothing; end if; end loop;
  insert into public.workflow_execucoes(automacao_id,evento_chave,orcamento_id,origem_id,destino_card_id,tarefa_id,status,executado_por_id,executado_por_nome) values(v_a.id,v_a.evento_chave,p_orcamento_id,p_origem_id,v_card_id,v_tarefa_id,'executado',p_usuario_id,p_usuario_nome) on conflict (automacao_id,orcamento_id) where orcamento_id is not null do nothing;
  return v_card_id;
end; $$;
revoke execute on function public.fn_workflow_executar_automacao_v1(uuid,uuid,text,uuid,text) from public,anon;
grant execute on function public.fn_workflow_executar_automacao_v1(uuid,uuid,text,uuid,text) to authenticated;

create or replace function public.fn_workflow_disparar_evento_v1(p_evento_chave text,p_orcamento_id uuid,p_origem_id text default null,p_usuario_id uuid default null,p_usuario_nome text default null) returns integer language plpgsql security definer set search_path=public as $$
declare v_a record; v_total integer:=0; v_card uuid;
begin for v_a in select id from public.workflow_automacoes where evento_chave=p_evento_chave and ativo=true order by ordem,created_at loop v_card:=public.fn_workflow_executar_automacao_v1(v_a.id,p_orcamento_id,p_origem_id,p_usuario_id,p_usuario_nome); if v_card is not null or exists(select 1 from public.workflow_execucoes e where e.automacao_id=v_a.id and e.orcamento_id=p_orcamento_id) then v_total:=v_total+1; end if; end loop; return v_total; end; $$;
revoke execute on function public.fn_workflow_disparar_evento_v1(text,uuid,text,uuid,text) from public,anon;
grant execute on function public.fn_workflow_disparar_evento_v1(text,uuid,text,uuid,text) to authenticated;

create or replace function public.fn_iniciar_fluxo_venda_v2(p_orcamento_id uuid,p_usuario_id uuid default null,p_usuario_nome text default null) returns table(venda_id uuid,projeto_card_id uuid,conta_id uuid) language plpgsql security definer set search_path=public as $$
declare v_orc public.orcamentos%rowtype; v_venda_id uuid; v_projeto_id uuid; v_conta_id uuid; v_coluna_vendido_id uuid; v_financeiro_ativo boolean;
begin
  perform pg_advisory_xact_lock(hashtext(p_orcamento_id::text)); select * into v_orc from public.orcamentos where id=p_orcamento_id for update; if not found then raise exception 'Orçamento não encontrado'; end if; if v_orc.cliente_id is null then raise exception 'Cliente precisa estar vinculado antes da confirmação da venda'; end if; if coalesce(v_orc.modo_entrada,'')='balcao' then raise exception 'Venda Balcão não usa o fluxo operacional de obras'; end if;
  insert into public.vendas_obras(orcamento_id,cliente_id,obra_id,valor_venda,custo_previsto,condicoes_snapshot,forma_pagamento_snapshot,itens_snapshot,confirmado_por_id,confirmado_por_nome) values(v_orc.id,v_orc.cliente_id,v_orc.obra_id,coalesce(v_orc.valor_estimado,0),v_orc.custo_estimado,v_orc.condicoes,v_orc.forma_pagamento,coalesce(v_orc.itens,'[]'::jsonb),p_usuario_id,p_usuario_nome) on conflict (orcamento_id) do nothing; select id into v_venda_id from public.vendas_obras where orcamento_id=v_orc.id;
  select exists(select 1 from public.workflow_automacoes where evento_chave='venda_confirmada' and acao_tipo='financeiro_venda' and ativo=true) into v_financeiro_ativo;
  if v_financeiro_ativo then select id into v_conta_id from public.financeiro_contas_receber where orcamento_id=v_orc.id and status<>'cancelado' order by created_at limit 1 for update; if v_conta_id is null then insert into public.financeiro_contas_receber(venda_obra_id,cliente_id,cliente_nome,documento,parcela,total_parcelas,data_emissao,vencimento,valor,status,forma,valor_pago,observacoes,criado_por_id,criado_por_nome,obra_id,orcamento_id) values(v_venda_id,v_orc.cliente_id,v_orc.cliente_nome,'Venda sob medida'||case when v_orc.numero is not null then ' - Orçamento #'||v_orc.numero else '' end,1,1,current_date,null,coalesce(v_orc.valor_estimado,0),'aberto',v_orc.forma_pagamento,0,'Pré-lançamento criado pela automação Venda confirmada → Financeiro. O Financeiro pode ajustar parcelas e vencimentos mantendo o histórico.',p_usuario_id,p_usuario_nome,v_orc.obra_id,v_orc.id) returning id into v_conta_id; else update public.financeiro_contas_receber set venda_obra_id=coalesce(venda_obra_id,v_venda_id),obra_id=coalesce(obra_id,v_orc.obra_id),updated_at=now() where id=v_conta_id; end if; end if;
  perform public.fn_workflow_disparar_evento_v1('venda_confirmada',v_orc.id,v_venda_id::text,p_usuario_id,p_usuario_nome); select ski.id into v_projeto_id from public.setor_kanban_itens ski join public.setor_kanban_colunas c on c.id=ski.coluna_id where c.setor_id='engenharia-projeto' and ski.orcamento_id=v_orc.id order by ski.created_at limit 1;
  select id into v_coluna_vendido_id from public.kanban_colunas where coalesce(gera_medicao_final,false)=true order by ordem limit 1; update public.orcamentos set status='vendido',coluna_id=coalesce(v_coluna_vendido_id,coluna_id),coluna_atualizada_em=case when v_coluna_vendido_id is not null then now() else coluna_atualizada_em end,updated_at=now() where id=v_orc.id; if v_orc.obra_id is not null then update public.obras set status='engenharia',updated_at=now() where id=v_orc.obra_id; end if; return query select v_venda_id,v_projeto_id,v_conta_id;
end; $$;
revoke execute on function public.fn_iniciar_fluxo_venda_v2(uuid,uuid,text) from public,anon; grant execute on function public.fn_iniciar_fluxo_venda_v2(uuid,uuid,text) to authenticated;

create or replace function public.fn_concluir_conferencia_projeto_v1(p_card_id uuid,p_coluna_id uuid,p_usuario_id uuid default null,p_usuario_nome text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_card public.setor_kanban_itens%rowtype; v_destino record; v_orc public.orcamentos%rowtype; v_medicao_id uuid; v_med_coluna_id uuid; v_cliente_endereco text; v_cliente_bairro text; v_cliente_cep text; v_obra_endereco text; v_obra_bairro text; v_obra_cep text; v_obra_cidade text; v_medicao_ativa boolean;
begin
  select * into v_card from public.setor_kanban_itens where id=p_card_id for update; if not found or v_card.orcamento_id is null then raise exception 'Card de projeto inválido'; end if; select c.nome,c.setor_id into v_destino from public.setor_kanban_colunas c where c.id=p_coluna_id; if v_destino.setor_id<>'engenharia-projeto' or lower(v_destino.nome)<>'projeto conferido' then raise exception 'Destino inválido para concluir a conferência do projeto'; end if; select * into v_orc from public.orcamentos where id=v_card.orcamento_id for update; if not found then raise exception 'Orçamento da venda não encontrado'; end if; update public.setor_kanban_itens set coluna_id=p_coluna_id,atualizado_em=now(),atualizado_por_id=p_usuario_id,atualizado_por_nome=p_usuario_nome where id=p_card_id;
  select exists(select 1 from public.workflow_automacoes where evento_chave='projeto_conferido' and acao_tipo='criar_medicao_final' and ativo=true) into v_medicao_ativa;
  if v_medicao_ativa then select id into v_medicao_id from public.medicoes_finais where orcamento_id=v_orc.id order by created_at limit 1 for update; if v_medicao_id is null then select id into v_med_coluna_id from public.medicao_colunas order by ordem limit 1; if v_med_coluna_id is null then insert into public.medicao_colunas(nome,ordem) values('Aguardando medida final',0) returning id into v_med_coluna_id; end if; if v_orc.cliente_id is not null then select endereco,bairro,cep into v_cliente_endereco,v_cliente_bairro,v_cliente_cep from public.clientes where id=v_orc.cliente_id; end if; if v_orc.obra_id is not null then select endereco,bairro,cep,cidade into v_obra_endereco,v_obra_bairro,v_obra_cep,v_obra_cidade from public.obras where id=v_orc.obra_id; end if; insert into public.medicoes_finais(orcamento_id,cliente_id,obra_id,cliente_nome,cliente_whatsapp,endereco,bairro,cep,cidade,coluna_id,coluna_atualizada_em,criado_por_id,criado_por_nome) values(v_orc.id,v_orc.cliente_id,v_orc.obra_id,v_orc.cliente_nome,v_orc.cliente_whatsapp,coalesce(v_obra_endereco,v_cliente_endereco,v_orc.obra_endereco),coalesce(v_obra_bairro,v_cliente_bairro,v_orc.obra_bairro),coalesce(v_obra_cep,v_cliente_cep,v_orc.obra_cep),coalesce(v_obra_cidade,v_orc.obra_cidade,v_orc.cidade),v_med_coluna_id,now(),p_usuario_id,coalesce(nullif(p_usuario_nome,''),'Engenharia — Projeto')) returning id into v_medicao_id; insert into public.medicao_itens(medicao_id,tipo_esquadria,tipo_outro_texto,descricao,quantidade,ordem) select v_medicao_id,coalesce(nullif(j.item->>'tipo_esquadria',''),'outro'),nullif(j.item->>'tipo_outro_texto',''),coalesce(nullif(j.item->>'descricao',''),nullif(j.item->>'ambiente',''),'Item '||j.ord::text),case when coalesce(j.item->>'quantidade','')~'^[0-9]+$' then greatest((j.item->>'quantidade')::int,1) else 1 end,(j.ord-1)::int from jsonb_array_elements(coalesce(v_orc.itens,'[]'::jsonb)) with ordinality as j(item,ord); end if; end if;
  perform public.fn_workflow_disparar_evento_v1('projeto_conferido',v_orc.id,coalesce(v_medicao_id::text,p_card_id::text),p_usuario_id,p_usuario_nome); if v_orc.obra_id is not null then update public.obras set status=case when v_medicao_id is not null then 'medicao' else 'engenharia' end,updated_at=now() where id=v_orc.obra_id; end if; return v_medicao_id;
end; $$;
revoke execute on function public.fn_concluir_conferencia_projeto_v1(uuid,uuid,uuid,text) from public,anon; grant execute on function public.fn_concluir_conferencia_projeto_v1(uuid,uuid,uuid,text) to authenticated;

create or replace function public.fn_medicao_aprovada_criar_vidro_v1() returns trigger language plpgsql security definer set search_path=public as $$ begin if new.status_operacional is distinct from 'aprovado' or old.status_operacional is not distinct from 'aprovado' then return new; end if; if new.orcamento_id is null then return new; end if; perform public.fn_workflow_disparar_evento_v1('medicao_aprovada',new.orcamento_id,new.id::text,new.aprovado_por_id,coalesce(new.aprovado_por_nome,'Automação Medição Final')); return new; end; $$;

create or replace function public.fn_medicao_aprovada_para_engenharia() returns trigger language plpgsql security definer set search_path=public as $$
declare v_automacao_id uuid; v_coluna_id uuid; v_item_existente uuid; v_itens text; v_descricao text;
begin
  if new.status_operacional is distinct from 'aprovado' or old.status_operacional is not distinct from 'aprovado' then return new; end if; if new.orcamento_id is null then return new; end if; select id,destino_coluna_id into v_automacao_id,v_coluna_id from public.workflow_automacoes where evento_chave='medicao_aprovada' and acao_tipo='mee_pos_medicao' and ativo=true order by ordem limit 1; if v_automacao_id is null then return new; end if; if v_coluna_id is null then select id into v_coluna_id from public.setor_kanban_colunas where setor_id='mee' order by ordem limit 1; end if; if v_coluna_id is null then insert into public.setor_kanban_colunas(setor_id,nome,ordem) values('mee','Recebidas',0) returning id into v_coluna_id; end if;
  select string_agg(format('%s. %s\\nTipo: %s\\nQuantidade: %s\\nLarguras mm (baixo / meio / cima): %s / %s / %s\\nAlturas mm (direita / meio / esquerda): %s / %s / %s',coalesce(mi.ordem,0)+1,coalesce(nullif(trim(mi.descricao),''),nullif(trim(mi.tipo_outro_texto),''),mi.tipo_esquadria,'Peça'),coalesce(mi.tipo_esquadria,'?'),greatest(coalesce(mi.quantidade,1),1),coalesce(mi.largura_baixo_mm::text,'?'),coalesce(mi.largura_meio_mm::text,'?'),coalesce(mi.largura_cima_mm::text,'?'),coalesce(mi.altura_direita_mm::text,'?'),coalesce(mi.altura_meio_mm::text,'?'),coalesce(mi.altura_esquerda_mm::text,'?')),E'\\n\\n' order by mi.ordem) into v_itens from public.medicao_itens mi where mi.medicao_id=new.id;
  v_descricao:=concat_ws(E'\n','MEDIÇÃO FINAL APROVADA','Cliente: '||coalesce(new.cliente_nome,'Não informado'),case when concat_ws(' · ',nullif(new.endereco,''),nullif(new.bairro,''),nullif(new.cidade,''))<>'' then 'Local: '||concat_ws(' · ',nullif(new.endereco,''),nullif(new.bairro,''),nullif(new.cidade,'')) else null end,'Medição: '||new.id::text,'Orçamento: '||new.orcamento_id::text,case when new.aprovado_por_nome is not null then 'Aprovado por: '||new.aprovado_por_nome else null end,'','PEÇAS APROVADAS',coalesce(v_itens,'Nenhuma peça encontrada'));
  select ski.id into v_item_existente from public.setor_kanban_itens ski join public.setor_kanban_colunas c on c.id=ski.coluna_id where c.setor_id='mee' and ski.orcamento_id=new.orcamento_id order by ski.created_at limit 1;
  if v_item_existente is not null then update public.setor_kanban_itens set titulo=new.cliente_nome,descricao=v_descricao,coluna_id=v_coluna_id,cliente_id=coalesce(cliente_id,new.cliente_id),obra_id=coalesce(obra_id,new.obra_id),atualizado_em=now(),atualizado_por_id=new.aprovado_por_id,atualizado_por_nome=new.aprovado_por_nome where id=v_item_existente; else insert into public.setor_kanban_itens(titulo,descricao,coluna_id,criado_por_id,criado_por_nome,orcamento_id,cliente_id,obra_id,atualizado_por_id,atualizado_por_nome) values(new.cliente_nome,v_descricao,v_coluna_id,new.aprovado_por_id,coalesce(new.aprovado_por_nome,'Automação Medição Final'),new.orcamento_id,new.cliente_id,new.obra_id,new.aprovado_por_id,new.aprovado_por_nome) returning id into v_item_existente; end if; perform public.fn_workflow_executar_automacao_v1(v_automacao_id,new.orcamento_id,new.id::text,new.aprovado_por_id,coalesce(new.aprovado_por_nome,'Automação Medição Final')); return new;
end; $$;

revoke execute on function public.fn_workflow_coluna_tarefa_v1(uuid) from authenticated;
