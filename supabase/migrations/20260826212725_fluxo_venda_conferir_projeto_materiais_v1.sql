-- Fluxo V1: Venda confirmada -> Financeiro + Conferir Projeto.
-- Projeto conferido -> Medicao Final + Perfis/Acessorios/Outros.
-- Medicao Final aprovada -> Vidros + Engenharia tecnica existente.

create table if not exists public.vendas_obras (
  id uuid primary key default gen_random_uuid(),
  numero bigserial unique,
  orcamento_id uuid not null unique references public.orcamentos(id) on delete restrict,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  obra_id uuid references public.obras(id) on delete set null,
  valor_venda numeric(14,2) not null default 0,
  custo_previsto numeric(14,2),
  condicoes_snapshot text,
  forma_pagamento_snapshot text,
  itens_snapshot jsonb not null default '[]'::jsonb,
  status text not null default 'ativa' check (status in ('ativa','cancelada','concluida')),
  versao integer not null default 1,
  confirmado_em timestamptz not null default now(),
  confirmado_por_id uuid references auth.users(id),
  confirmado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendas_obras_cliente_idx on public.vendas_obras(cliente_id, created_at desc);
create index if not exists vendas_obras_obra_idx on public.vendas_obras(obra_id, created_at desc);

alter table public.vendas_obras enable row level security;
drop policy if exists vendas_obras_authenticated_all on public.vendas_obras;
create policy vendas_obras_authenticated_all on public.vendas_obras for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.vendas_obras to authenticated;
grant usage, select on sequence public.vendas_obras_numero_seq to authenticated;

create table if not exists public.venda_obra_revisoes (
  id uuid primary key default gen_random_uuid(),
  venda_obra_id uuid not null references public.vendas_obras(id) on delete cascade,
  versao integer not null,
  tipo text not null default 'ajuste',
  justificativa text not null check (length(trim(justificativa)) > 0),
  antes jsonb,
  depois jsonb,
  impacto_valor numeric(14,2),
  impacto_custo numeric(14,2),
  criado_por_id uuid references auth.users(id),
  criado_por_nome text,
  created_at timestamptz not null default now(),
  unique (venda_obra_id, versao)
);

alter table public.venda_obra_revisoes enable row level security;
drop policy if exists venda_obra_revisoes_authenticated_all on public.venda_obra_revisoes;
create policy venda_obra_revisoes_authenticated_all on public.venda_obra_revisoes for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.venda_obra_revisoes to authenticated;

alter table public.financeiro_contas_receber add column if not exists venda_obra_id uuid;
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'financeiro_contas_receber_venda_obra_id_fkey'
  ) then
    alter table public.financeiro_contas_receber
      add constraint financeiro_contas_receber_venda_obra_id_fkey
      foreign key (venda_obra_id) references public.vendas_obras(id) on delete set null;
  end if;
end $$;
create index if not exists financeiro_contas_receber_venda_obra_idx on public.financeiro_contas_receber(venda_obra_id);

alter table public.setor_kanban_itens
  add column if not exists cliente_id uuid,
  add column if not exists obra_id uuid,
  add column if not exists atualizado_por_id uuid,
  add column if not exists atualizado_por_nome text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'setor_kanban_itens_cliente_id_fkey') then
    alter table public.setor_kanban_itens add constraint setor_kanban_itens_cliente_id_fkey foreign key (cliente_id) references public.clientes(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'setor_kanban_itens_obra_id_fkey') then
    alter table public.setor_kanban_itens add constraint setor_kanban_itens_obra_id_fkey foreign key (obra_id) references public.obras(id) on delete set null;
  end if;
end $$;

create index if not exists setor_kanban_itens_cliente_idx on public.setor_kanban_itens(cliente_id, created_at desc);
create index if not exists setor_kanban_itens_obra_idx on public.setor_kanban_itens(obra_id, created_at desc);

update public.setor_kanban_itens ski
   set cliente_id = coalesce(ski.cliente_id, o.cliente_id),
       obra_id = coalesce(ski.obra_id, o.obra_id)
  from public.orcamentos o
 where ski.orcamento_id = o.id
   and (ski.cliente_id is null or ski.obra_id is null);

create or replace function public.fn_setor_item_contexto_orcamento_v1()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.orcamento_id is not null then
    select o.cliente_id, o.obra_id into new.cliente_id, new.obra_id
      from public.orcamentos o where o.id = new.orcamento_id;
  end if;
  if tg_op = 'UPDATE' and new.coluna_id is distinct from old.coluna_id then
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_setor_item_contexto_orcamento_v1() from public, anon, authenticated;
drop trigger if exists trg_setor_item_contexto_orcamento_v1 on public.setor_kanban_itens;
create trigger trg_setor_item_contexto_orcamento_v1
before insert or update of orcamento_id, coluna_id on public.setor_kanban_itens
for each row execute function public.fn_setor_item_contexto_orcamento_v1();

create table if not exists public.setor_kanban_movimentos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.setor_kanban_itens(id) on delete cascade,
  de_coluna_id uuid references public.setor_kanban_colunas(id) on delete set null,
  para_coluna_id uuid references public.setor_kanban_colunas(id) on delete set null,
  justificativa text,
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz not null default now()
);
create index if not exists setor_kanban_movimentos_item_idx on public.setor_kanban_movimentos(item_id, created_at desc);
alter table public.setor_kanban_movimentos enable row level security;
drop policy if exists setor_kanban_movimentos_authenticated_select on public.setor_kanban_movimentos;
create policy setor_kanban_movimentos_authenticated_select on public.setor_kanban_movimentos for select to authenticated using (true);
grant select on public.setor_kanban_movimentos to authenticated;

create or replace function public.fn_registrar_movimento_setor_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.coluna_id is distinct from old.coluna_id then
    insert into public.setor_kanban_movimentos(item_id, de_coluna_id, para_coluna_id, usuario_id, usuario_nome)
    values (new.id, case when tg_op = 'UPDATE' then old.coluna_id else null end, new.coluna_id, new.atualizado_por_id, coalesce(new.atualizado_por_nome, new.criado_por_nome));
  end if;
  return new;
end;
$$;
revoke execute on function public.fn_registrar_movimento_setor_v1() from public, anon, authenticated;
drop trigger if exists trg_registrar_movimento_setor_v1 on public.setor_kanban_itens;
create trigger trg_registrar_movimento_setor_v1
after insert or update of coluna_id on public.setor_kanban_itens
for each row execute function public.fn_registrar_movimento_setor_v1();

insert into public.setores(id,nome,grupo,ordem,ativo,rota,descricao)
values
  ('engenharia-projeto','Engenharia — Conferir Projeto','Técnico',1,false,null,'Conferência do projeto vendido antes de liberar medição e materiais.'),
  ('compras-perfis','Perfis','Operações',20,false,null,'Fluxo de perfis por obra.'),
  ('compras-acessorios','Acessórios','Operações',21,false,null,'Fluxo de acessórios por obra.'),
  ('compras-vidros','Vidros','Operações',22,false,null,'Fluxo de vidros por obra; nasce após Medição Final aprovada.'),
  ('compras-outros','Outros materiais','Operações',23,false,null,'Outros materiais necessários para a obra.')
on conflict (id) do update set
  nome = excluded.nome,
  grupo = excluded.grupo,
  ordem = excluded.ordem,
  descricao = excluded.descricao;

insert into public.setor_kanban_colunas(setor_id,nome,ordem)
select v.setor_id, v.nome, v.ordem
from (values
  ('engenharia-projeto','A conferir',0),
  ('engenharia-projeto','Em conferência',1),
  ('engenharia-projeto','Aguardando ajuste',2),
  ('engenharia-projeto','Projeto conferido',3),
  ('compras-perfis','Pendente',0),
  ('compras-perfis','Em compra',1),
  ('compras-perfis','Comprado',2),
  ('compras-perfis','Aguardando entrega',3),
  ('compras-perfis','Recebido',4),
  ('compras-perfis','Separado',5),
  ('compras-perfis','Liberado',6),
  ('compras-acessorios','Pendente',0),
  ('compras-acessorios','Em compra',1),
  ('compras-acessorios','Comprado',2),
  ('compras-acessorios','Aguardando entrega',3),
  ('compras-acessorios','Recebido',4),
  ('compras-acessorios','Separado',5),
  ('compras-acessorios','Liberado',6),
  ('compras-vidros','Pendente',0),
  ('compras-vidros','Em compra',1),
  ('compras-vidros','Comprado',2),
  ('compras-vidros','Aguardando entrega',3),
  ('compras-vidros','Recebido',4),
  ('compras-vidros','Separado',5),
  ('compras-vidros','Liberado',6),
  ('compras-outros','Pendente',0),
  ('compras-outros','Em compra',1),
  ('compras-outros','Comprado',2),
  ('compras-outros','Aguardando entrega',3),
  ('compras-outros','Recebido',4),
  ('compras-outros','Separado',5),
  ('compras-outros','Liberado',6)
) as v(setor_id,nome,ordem)
where not exists (
  select 1 from public.setor_kanban_colunas c where c.setor_id=v.setor_id and lower(c.nome)=lower(v.nome)
);

create or replace function public.fn_fluxo_upsert_card_setor_v1(
  p_setor_id text,
  p_orcamento_id uuid,
  p_titulo text,
  p_descricao text,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coluna_id uuid;
  v_item_id uuid;
begin
  select id into v_coluna_id from public.setor_kanban_colunas where setor_id=p_setor_id order by ordem asc limit 1;
  if v_coluna_id is null then raise exception 'Fluxo % sem coluna inicial', p_setor_id; end if;

  select ski.id into v_item_id
  from public.setor_kanban_itens ski
  join public.setor_kanban_colunas c on c.id=ski.coluna_id
  where c.setor_id=p_setor_id and ski.orcamento_id=p_orcamento_id
  order by ski.created_at asc limit 1 for update;

  if v_item_id is null then
    insert into public.setor_kanban_itens(titulo,descricao,coluna_id,criado_por_id,criado_por_nome,orcamento_id,atualizado_por_id,atualizado_por_nome)
    values (p_titulo,p_descricao,v_coluna_id,p_usuario_id,coalesce(nullif(p_usuario_nome,''),'Automação'),p_orcamento_id,p_usuario_id,p_usuario_nome)
    returning id into v_item_id;
  else
    update public.setor_kanban_itens
       set titulo=p_titulo,
           descricao=p_descricao,
           atualizado_em=now(),
           atualizado_por_id=p_usuario_id,
           atualizado_por_nome=p_usuario_nome
     where id=v_item_id;
  end if;
  return v_item_id;
end;
$$;
revoke execute on function public.fn_fluxo_upsert_card_setor_v1(text,uuid,text,text,uuid,text) from public, anon, authenticated;

create or replace function public.fn_iniciar_fluxo_venda_v2(
  p_orcamento_id uuid,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
)
returns table(venda_id uuid, projeto_card_id uuid, conta_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orc public.orcamentos%rowtype;
  v_venda_id uuid;
  v_projeto_id uuid;
  v_fin_card uuid;
  v_conta_id uuid;
  v_desc text;
begin
  perform pg_advisory_xact_lock(hashtext(p_orcamento_id::text));
  select * into v_orc from public.orcamentos where id=p_orcamento_id for update;
  if not found then raise exception 'Orçamento não encontrado'; end if;
  if v_orc.cliente_id is null then raise exception 'Cliente precisa estar vinculado antes da confirmação da venda'; end if;
  if coalesce(v_orc.modo_entrada,'')='balcao' then raise exception 'Venda Balcão não usa o fluxo operacional de obras'; end if;

  insert into public.vendas_obras(
    orcamento_id,cliente_id,obra_id,valor_venda,custo_previsto,condicoes_snapshot,forma_pagamento_snapshot,itens_snapshot,confirmado_por_id,confirmado_por_nome
  ) values (
    v_orc.id,v_orc.cliente_id,v_orc.obra_id,coalesce(v_orc.valor_estimado,0),v_orc.custo_estimado,v_orc.condicoes,v_orc.forma_pagamento,coalesce(v_orc.itens,'[]'::jsonb),p_usuario_id,p_usuario_nome
  ) on conflict (orcamento_id) do nothing;

  select id into v_venda_id from public.vendas_obras where orcamento_id=v_orc.id;

  select id into v_conta_id
  from public.financeiro_contas_receber
  where orcamento_id=v_orc.id and status <> 'cancelado'
  order by created_at asc limit 1 for update;

  if v_conta_id is null then
    insert into public.financeiro_contas_receber(
      venda_obra_id,cliente_id,cliente_nome,documento,parcela,total_parcelas,data_emissao,vencimento,valor,status,forma,valor_pago,observacoes,criado_por_id,criado_por_nome,obra_id,orcamento_id
    ) values (
      v_venda_id,v_orc.cliente_id,v_orc.cliente_nome,
      'Venda sob medida' || case when v_orc.numero is not null then ' - Orçamento #'||v_orc.numero else '' end,
      1,1,current_date,null,coalesce(v_orc.valor_estimado,0),'aberto',v_orc.forma_pagamento,0,
      'Pré-lançamento criado na confirmação da venda. Financeiro pode ajustar parcelas, vencimentos e condições mantendo o histórico da venda.',
      p_usuario_id,p_usuario_nome,v_orc.obra_id,v_orc.id
    ) returning id into v_conta_id;
  else
    update public.financeiro_contas_receber set venda_obra_id=coalesce(venda_obra_id,v_venda_id), obra_id=coalesce(obra_id,v_orc.obra_id), updated_at=now() where id=v_conta_id;
  end if;

  v_desc := concat_ws(E'\n',
    'VENDA CONFIRMADA',
    'Cliente: '||coalesce(v_orc.cliente_nome,'Não informado'),
    case when v_orc.numero is not null then 'Orçamento: #'||v_orc.numero else null end,
    case when v_orc.obra_id is not null then 'Obra vinculada: '||v_orc.obra_id::text else 'Obra: não vinculada' end,
    '',
    'CONFERIR PROJETO',
    'Revisar tipologias, montagem, perfis, acessórios, ferragens, sentido de abertura, medidas de projeto e demais definições técnicas antes de liberar compras e Medição Final.'
  );

  v_projeto_id := public.fn_fluxo_upsert_card_setor_v1('engenharia-projeto',v_orc.id,v_orc.cliente_nome,v_desc,p_usuario_id,p_usuario_nome);
  v_fin_card := public.fn_fluxo_upsert_card_setor_v1('financeiro',v_orc.id,v_orc.cliente_nome,
    concat_ws(E'\n','VENDA CONFIRMADA','Valor: R$ '||to_char(coalesce(v_orc.valor_estimado,0),'FM999G999G990D00'),coalesce('Condições: '||nullif(v_orc.condicoes,''),null),coalesce('Forma: '||nullif(v_orc.forma_pagamento,''),null)),
    p_usuario_id,p_usuario_nome);

  update public.orcamentos set status='vendido', updated_at=now() where id=v_orc.id;
  if v_orc.obra_id is not null then update public.obras set status='engenharia', updated_at=now() where id=v_orc.obra_id; end if;

  return query select v_venda_id,v_projeto_id,v_conta_id;
end;
$$;
revoke execute on function public.fn_iniciar_fluxo_venda_v2(uuid,uuid,text) from public, anon;
grant execute on function public.fn_iniciar_fluxo_venda_v2(uuid,uuid,text) to authenticated;

create or replace function public.fn_concluir_conferencia_projeto_v1(
  p_card_id uuid,
  p_coluna_id uuid,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.setor_kanban_itens%rowtype;
  v_destino record;
  v_orc public.orcamentos%rowtype;
  v_medicao_id uuid;
  v_med_coluna_id uuid;
  v_cliente record;
  v_obra record;
  v_desc text;
begin
  select * into v_card from public.setor_kanban_itens where id=p_card_id for update;
  if not found or v_card.orcamento_id is null then raise exception 'Card de projeto inválido'; end if;

  select c.nome,c.setor_id into v_destino from public.setor_kanban_colunas c where c.id=p_coluna_id;
  if v_destino.setor_id <> 'engenharia-projeto' or lower(v_destino.nome) <> 'projeto conferido' then
    raise exception 'Destino inválido para concluir a conferência do projeto';
  end if;

  select * into v_orc from public.orcamentos where id=v_card.orcamento_id for update;
  if not found then raise exception 'Orçamento da venda não encontrado'; end if;

  update public.setor_kanban_itens
     set coluna_id=p_coluna_id,atualizado_em=now(),atualizado_por_id=p_usuario_id,atualizado_por_nome=p_usuario_nome
   where id=p_card_id;

  select id into v_medicao_id from public.medicoes_finais where orcamento_id=v_orc.id order by created_at asc limit 1 for update;
  if v_medicao_id is null then
    select id into v_med_coluna_id from public.medicao_colunas order by ordem asc limit 1;
    if v_med_coluna_id is null then
      insert into public.medicao_colunas(nome,ordem) values ('Aguardando medida final',0) returning id into v_med_coluna_id;
    end if;

    if v_orc.cliente_id is not null then select endereco,bairro,cep into v_cliente from public.clientes where id=v_orc.cliente_id; end if;
    if v_orc.obra_id is not null then select endereco,bairro,cep,cidade into v_obra from public.obras where id=v_orc.obra_id; end if;

    insert into public.medicoes_finais(
      orcamento_id,cliente_id,obra_id,cliente_nome,cliente_whatsapp,endereco,bairro,cep,cidade,coluna_id,coluna_atualizada_em,criado_por_id,criado_por_nome
    ) values (
      v_orc.id,v_orc.cliente_id,v_orc.obra_id,v_orc.cliente_nome,v_orc.cliente_whatsapp,
      coalesce(v_obra.endereco,v_cliente.endereco,v_orc.obra_endereco),
      coalesce(v_obra.bairro,v_cliente.bairro,v_orc.obra_bairro),
      coalesce(v_obra.cep,v_cliente.cep,v_orc.obra_cep),
      coalesce(v_obra.cidade,v_orc.obra_cidade,v_orc.cidade),
      v_med_coluna_id,now(),p_usuario_id,coalesce(nullif(p_usuario_nome,''),'Engenharia — Projeto')
    ) returning id into v_medicao_id;

    insert into public.medicao_itens(medicao_id,tipo_esquadria,tipo_outro_texto,descricao,quantidade,ordem)
    select v_medicao_id,
           coalesce(nullif(j.item->>'tipo_esquadria',''),'outro'),
           nullif(j.item->>'tipo_outro_texto',''),
           coalesce(nullif(j.item->>'descricao',''),nullif(j.item->>'ambiente',''),'Item '||j.ord::text),
           case when coalesce(j.item->>'quantidade','') ~ '^[0-9]+$' then greatest((j.item->>'quantidade')::int,1) else 1 end,
           (j.ord-1)::int
      from jsonb_array_elements(coalesce(v_orc.itens,'[]'::jsonb)) with ordinality as j(item,ord);
  end if;

  v_desc := concat_ws(E'\n','PROJETO CONFERIDO','Cliente: '||coalesce(v_orc.cliente_nome,'Não informado'),'Aguardando detalhamento/necessidade do material a partir do projeto conferido.');
  perform public.fn_fluxo_upsert_card_setor_v1('compras-perfis',v_orc.id,v_orc.cliente_nome,v_desc,p_usuario_id,p_usuario_nome);
  perform public.fn_fluxo_upsert_card_setor_v1('compras-acessorios',v_orc.id,v_orc.cliente_nome,v_desc,p_usuario_id,p_usuario_nome);
  perform public.fn_fluxo_upsert_card_setor_v1('compras-outros',v_orc.id,v_orc.cliente_nome,v_desc,p_usuario_id,p_usuario_nome);

  if v_orc.obra_id is not null then update public.obras set status='medicao',updated_at=now() where id=v_orc.obra_id; end if;
  return v_medicao_id;
end;
$$;
revoke execute on function public.fn_concluir_conferencia_projeto_v1(uuid,uuid,uuid,text) from public, anon;
grant execute on function public.fn_concluir_conferencia_projeto_v1(uuid,uuid,uuid,text) to authenticated;

create or replace function public.fn_medicao_aprovada_criar_vidro_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orc public.orcamentos%rowtype;
  v_desc text;
begin
  if new.status_operacional is distinct from 'aprovado' or old.status_operacional is not distinct from 'aprovado' then return new; end if;
  if new.orcamento_id is null then return new; end if;
  select * into v_orc from public.orcamentos where id=new.orcamento_id;
  if not found then return new; end if;

  v_desc := concat_ws(E'\n','MEDIÇÃO FINAL APROVADA','Cliente: '||coalesce(new.cliente_nome,v_orc.cliente_nome,'Não informado'),'Medição: '||new.id::text,'Vidros liberados para detalhamento e compra somente após esta aprovação.');
  perform public.fn_fluxo_upsert_card_setor_v1('compras-vidros',v_orc.id,coalesce(new.cliente_nome,v_orc.cliente_nome),v_desc,new.aprovado_por_id,coalesce(new.aprovado_por_nome,'Automação Medição Final'));
  return new;
end;
$$;
revoke execute on function public.fn_medicao_aprovada_criar_vidro_v1() from public, anon, authenticated;
drop trigger if exists trg_medicao_aprovada_criar_vidro_v1 on public.medicoes_finais;
create trigger trg_medicao_aprovada_criar_vidro_v1
after update of status_operacional on public.medicoes_finais
for each row when (new.status_operacional='aprovado') execute function public.fn_medicao_aprovada_criar_vidro_v1();

-- O fluxo Vendido antigo criava Medida Final e Instalação cedo demais.
-- A partir desta versão, o gatilho oficial é a confirmação da venda acima.
update public.automacoes_setor a
   set ativo=false
 where a.coluna_id in (select id from public.kanban_colunas where lower(nome)='vendido')
   and a.setor_id in ('financeiro','instalacao','medida-final-msdwtt9y','medida-final-msdhhol2');
