-- Automacao aditiva: card da Instalacao + tarefa individual quando o fluxo técnico
-- de producao_concluida ja confirmou a liberacao no workflow existente.
-- Nunca altera posicoes de cards existentes nem reabre tarefas.
create or replace function private.fn_instalacao_apos_producao_execucao_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_regra public.workflow_automacoes%rowtype;
 v_orc record;
 v_venda uuid;
 v_coluna uuid;
 v_pessoa record;
 v_coluna_tarefa uuid;
 v_tarefa uuid;
 v_nome_obra text;
 v_href text;
begin
 if new.evento_chave <> 'producao_concluida' or new.status <> 'executado'
    or new.orcamento_id is null then return new; end if;

 -- Somente o workflow realmente dirigido para a Instalacao, e na mesma empresa.
 if not exists (
   select 1 from public.workflow_automacoes a
   where a.id=new.automacao_id and a.empresa_id=new.empresa_id
     and a.acao_tipo='criar_card_setor' and a.destino_setor_id='instalacao'
 ) then return new; end if;

 select o.id,o.cliente_id,o.obra_id,o.cliente_nome
 into v_orc from public.orcamentos o
 where o.id=new.orcamento_id and o.empresa_id=new.empresa_id;
 if not found then return new; end if;

 select v.id into v_venda from public.vendas_obras v
 where v.empresa_id=new.empresa_id and v.orcamento_id=new.orcamento_id
   and (v_orc.obra_id is null or v.obra_id=v_orc.obra_id)
 order by v.created_at desc limit 1;
 if v_venda is null then return new; end if;

 -- Entrada na primeira etapa, apenas se a obra ainda nao tiver posicao.
 -- A unique key (empresa_id,setor,venda_obra_id) evita duplo card.
 select c.id into v_coluna from public.central_kanban_colunas c
 where c.empresa_id=new.empresa_id and c.setor='instalacao' and c.ordem=0
 order by c.id limit 1;
 if v_coluna is not null then
  insert into public.central_kanban_posicoes
   (empresa_id,setor,venda_obra_id,coluna_id,atualizado_por_id)
  values(new.empresa_id,'instalacao',v_venda,v_coluna,new.executado_por_id)
  on conflict (empresa_id,setor,venda_obra_id) do nothing;
 end if;

 select * into v_regra from public.workflow_automacoes a
 where a.empresa_id=new.empresa_id
   and a.evento_chave='producao_concluida_instalacao_tarefas'
   and a.acao_tipo='reservado' and a.ativo and a.criar_tarefa
 order by a.created_at desc limit 1;
 if not found then return new; end if;

 select nome into v_nome_obra from public.obras
 where empresa_id=new.empresa_id and id=v_orc.obra_id;
 v_nome_obra:=coalesce(nullif(v_nome_obra,''),nullif(v_orc.cliente_nome,''),'Obra');
 v_href:='/kanban?setor=instalacao';

 for v_pessoa in
   select u.id,u.nome from public.usuarios u
   where u.empresa_id=new.empresa_id
    and u.id=any(v_regra.notificar_usuario_ids)
 loop
  -- Reutiliza quadro de tarefas existente sem sobrescrever cards.
  select tc.id into v_coluna_tarefa from public.tarefa_colunas tc
   where tc.empresa_id=new.empresa_id and tc.usuario_id=v_pessoa.id
   order by tc.ordem,tc.created_at limit 1;
  if v_coluna_tarefa is null then
    insert into public.tarefa_colunas (empresa_id,usuario_id,nome,ordem)
    values (new.empresa_id,v_pessoa.id,'A fazer',0)
    returning id into v_coluna_tarefa;
  end if;
  v_tarefa:=null;
  insert into public.tarefas
   (empresa_id,usuario_id,coluna_id,titulo,descricao,solicitante_id,
    solicitante_nome,atribuida_em,prioridade,workflow_automacao_id,
    orcamento_id,cliente_id,obra_id)
  values
   (new.empresa_id,v_pessoa.id,v_coluna_tarefa,
    'Organizar instalação · '||v_nome_obra,
    'Produção concluída e obra liberada para preparação da instalação.'||E'\n'||
    'Cliente: '||coalesce(v_orc.cliente_nome,'—')||E'\n'||
    'Conferir agendamento, equipe e liberação de instalação: '||v_href,
    new.executado_por_id,new.executado_por_nome,now(),
    coalesce(v_regra.prioridade_tarefa,'normal'),v_regra.id,
    new.orcamento_id,v_orc.cliente_id,v_orc.obra_id)
  on conflict (workflow_automacao_id,orcamento_id,usuario_id)
   where workflow_automacao_id is not null and orcamento_id is not null
  do nothing returning id into v_tarefa;

  -- A trigger de tarefas envia um aviso quando outra pessoa atribui a tarefa.
  -- Quando foi criada sem solicitante ou para o próprio solicitante,
  -- envia um único aviso alternativo, também idempotente.
  if v_tarefa is not null and
     (new.executado_por_id is null or new.executado_por_id=v_pessoa.id) then
    insert into public.notificacoes
     (empresa_id,usuario_id,categoria,tipo,titulo,mensagem,href,
      origem_tipo,origem_id,criado_por_id,criado_por_nome)
    values
     (new.empresa_id,v_pessoa.id,'operacao','tarefa',
      'Instalação aguardando organização',
      'Produção concluída para '||v_nome_obra||'. Confira sua tarefa.',
      '/tarefas','producao_instalacao',v_tarefa::text,
      new.executado_por_id,new.executado_por_nome)
    on conflict (usuario_id,origem_tipo,origem_id)
     where origem_tipo is not null and origem_id is not null do nothing;
  end if;
 end loop;
 return new;
exception when others then
 -- Nunca derrubar o fechamento da producao por uma falha secundária
 -- de encaminhamento; o erro fica registrado nos logs do Postgres.
 raise warning 'Atlas instalacao apos producao: % / %',SQLSTATE,SQLERRM;
 return new;
end;
$$;
revoke all on function private.fn_instalacao_apos_producao_execucao_v1()
 from public,anon,authenticated;
drop trigger if exists trg_instalacao_apos_producao_execucao_v1 on public.workflow_execucoes;
create trigger trg_instalacao_apos_producao_execucao_v1
after insert on public.workflow_execucoes
for each row execute function private.fn_instalacao_apos_producao_execucao_v1();
