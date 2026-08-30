-- Atlas One — ordens de produção vinculadas + revisão operacional da venda

alter table public.vendas_obras
  add column if not exists config_snapshot jsonb not null default '{}'::jsonb;

update public.vendas_obras v
set config_snapshot = jsonb_strip_nulls(jsonb_build_object(
  'contramarco', o.contramarco,
  'tipo_esquadria', o.tipo_esquadria,
  'largura_mm', o.largura_mm,
  'altura_mm', o.altura_mm,
  'quantidade', o.quantidade,
  'acabamento', o.acabamento
))
from public.orcamentos o
where o.id=v.orcamento_id and (v.config_snapshot is null or v.config_snapshot='{}'::jsonb);

create or replace function public.vendas_obras_preencher_config_snapshot_v1()
returns trigger
language plpgsql
set search_path=public
as $$
declare v_orc public.orcamentos%rowtype;
begin
  if new.config_snapshot is null or new.config_snapshot='{}'::jsonb then
    select * into v_orc from public.orcamentos where id=new.orcamento_id;
    if found then
      new.config_snapshot:=jsonb_strip_nulls(jsonb_build_object(
        'contramarco',v_orc.contramarco,
        'tipo_esquadria',v_orc.tipo_esquadria,
        'largura_mm',v_orc.largura_mm,
        'altura_mm',v_orc.altura_mm,
        'quantidade',v_orc.quantidade,
        'acabamento',v_orc.acabamento
      ));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vendas_obras_config_snapshot on public.vendas_obras;
create trigger trg_vendas_obras_config_snapshot
before insert on public.vendas_obras
for each row execute function public.vendas_obras_preencher_config_snapshot_v1();

create sequence if not exists public.ordens_producao_numero_seq;

create table if not exists public.ordens_producao (
  id uuid primary key default gen_random_uuid(),
  numero bigint not null default nextval('public.ordens_producao_numero_seq'),
  setor_card_id uuid references public.setor_kanban_itens(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  obra_id uuid references public.obras(id) on delete set null,
  venda_obra_id uuid references public.vendas_obras(id) on delete set null,
  orcamento_id uuid references public.orcamentos(id) on delete set null,
  revisao_id uuid references public.venda_obra_revisoes(id) on delete set null,
  item_ref text,
  item_snapshot jsonb not null default '{}'::jsonb,
  tipo_producao text not null default 'esquadria',
  titulo text not null,
  quantidade numeric not null default 1,
  largura_mm numeric,
  altura_mm numeric,
  status text not null default 'aguardando',
  bloqueada boolean not null default false,
  bloqueio_motivo text,
  origem text not null default 'manual',
  criado_por_id uuid references public.usuarios(id) on delete set null,
  criado_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ordens_producao_tipo_check check (tipo_producao in ('contramarco','esquadria','personalizada')),
  constraint ordens_producao_status_check check (status in ('aguardando','liberada','em_producao','conferencia','concluida','cancelada')),
  constraint ordens_producao_origem_check check (origem in ('workflow','manual')),
  constraint ordens_producao_quantidade_check check (quantidade > 0)
);

create unique index if not exists ordens_producao_venda_item_tipo_unique
  on public.ordens_producao(venda_obra_id,item_ref,tipo_producao)
  where venda_obra_id is not null and item_ref is not null;
create index if not exists ordens_producao_obra_idx on public.ordens_producao(obra_id,status,created_at);
create index if not exists ordens_producao_orcamento_idx on public.ordens_producao(orcamento_id,created_at);
create index if not exists ordens_producao_card_idx on public.ordens_producao(setor_card_id);

alter table public.ordens_producao enable row level security;
drop policy if exists ordens_producao_auth_all on public.ordens_producao;
create policy ordens_producao_auth_all on public.ordens_producao for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
grant select,insert,update,delete on public.ordens_producao to authenticated;
grant usage,select on sequence public.ordens_producao_numero_seq to authenticated;

alter table public.planos_corte
  add column if not exists ordem_producao_id uuid references public.ordens_producao(id) on delete set null,
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null,
  add column if not exists obra_id uuid references public.obras(id) on delete set null,
  add column if not exists venda_obra_id uuid references public.vendas_obras(id) on delete set null,
  add column if not exists orcamento_id uuid references public.orcamentos(id) on delete set null,
  add column if not exists item_ref text,
  add column if not exists tipo_producao text;
create index if not exists planos_corte_ordem_producao_idx on public.planos_corte(ordem_producao_id);
create index if not exists planos_corte_obra_idx on public.planos_corte(obra_id,created_at desc);

create or replace function public.ordens_producao_touch_updated_at_v1()
returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists trg_ordens_producao_updated_at on public.ordens_producao;
create trigger trg_ordens_producao_updated_at before update on public.ordens_producao for each row execute function public.ordens_producao_touch_updated_at_v1();

create or replace function public.fn_venda_estado_atual_v1(p_venda_obra_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_venda public.vendas_obras%rowtype; v_estado jsonb; v_revisao jsonb;
begin
  select * into v_venda from public.vendas_obras where id=p_venda_obra_id;
  if not found then return null; end if;
  v_estado:=jsonb_build_object(
    'valor_venda',v_venda.valor_venda,
    'custo_previsto',v_venda.custo_previsto,
    'itens_snapshot',coalesce(v_venda.itens_snapshot,'[]'::jsonb),
    'config_snapshot',coalesce(v_venda.config_snapshot,'{}'::jsonb),
    'versao',v_venda.versao
  );
  select r.depois into v_revisao from public.venda_obra_revisoes r where r.venda_obra_id=p_venda_obra_id order by r.versao desc,r.created_at desc limit 1;
  return coalesce(v_revisao,v_estado);
end;
$$;
revoke execute on function public.fn_venda_estado_atual_v1(uuid) from public,anon;
grant execute on function public.fn_venda_estado_atual_v1(uuid) to authenticated;

create or replace function public.fn_criar_ordens_producao_v1(
  p_orcamento_id uuid,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
) returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_venda public.vendas_obras%rowtype;
  v_estado jsonb;
  v_item jsonb;
  v_ord bigint;
  v_ref text;
  v_titulo text;
  v_qtd numeric;
  v_larg numeric;
  v_alt numeric;
  v_contramarco text;
  v_tem_contramarco boolean;
  v_card_id uuid;
  v_revisao_id uuid;
  v_total integer:=0;
begin
  select * into v_venda from public.vendas_obras where orcamento_id=p_orcamento_id order by created_at limit 1;
  if not found then return 0; end if;
  v_estado:=public.fn_venda_estado_atual_v1(v_venda.id);
  select r.id into v_revisao_id from public.venda_obra_revisoes r where r.venda_obra_id=v_venda.id order by r.versao desc,r.created_at desc limit 1;
  select ski.id into v_card_id
    from public.setor_kanban_itens ski join public.setor_kanban_colunas c on c.id=ski.coluna_id
   where c.setor_id='producao' and ski.orcamento_id=p_orcamento_id order by ski.created_at limit 1;

  for v_item,v_ord in select item,ord from jsonb_array_elements(coalesce(v_estado->'itens_snapshot','[]'::jsonb)) with ordinality j(item,ord) loop
    v_ref:=coalesce(nullif(v_item->>'id',''),'item-'||v_ord::text);
    v_titulo:=coalesce(nullif(v_item->>'tipo_outro_texto',''),nullif(v_item->>'tipo_esquadria',''),nullif(v_item->>'descricao',''),nullif(v_item->>'ambiente',''),'Item '||v_ord::text);
    v_qtd:=case when coalesce(v_item->>'quantidade','') ~ '^[0-9]+([.][0-9]+)?$' then greatest((v_item->>'quantidade')::numeric,1) else 1 end;
    v_larg:=case when coalesce(v_item->>'largura_mm','') ~ '^[0-9]+([.][0-9]+)?$' then (v_item->>'largura_mm')::numeric else null end;
    v_alt:=case when coalesce(v_item->>'altura_mm','') ~ '^[0-9]+([.][0-9]+)?$' then (v_item->>'altura_mm')::numeric else null end;
    v_contramarco:=lower(coalesce(nullif(v_item->>'contramarco',''),nullif(v_estado->'config_snapshot'->>'contramarco',''),'sem'));
    v_tem_contramarco:=v_contramarco in ('com','sim','true','1','com contramarco','com_contramarco');

    insert into public.ordens_producao(setor_card_id,cliente_id,obra_id,venda_obra_id,orcamento_id,revisao_id,item_ref,item_snapshot,tipo_producao,titulo,quantidade,largura_mm,altura_mm,status,bloqueada,bloqueio_motivo,origem,criado_por_id,criado_por_nome)
    values(v_card_id,v_venda.cliente_id,v_venda.obra_id,v_venda.id,p_orcamento_id,v_revisao_id,v_ref,v_item,'esquadria',v_titulo,v_qtd,v_larg,v_alt,'aguardando',true,'Aguardando Medição Final e liberação dos materiais','workflow',p_usuario_id,p_usuario_nome)
    on conflict (venda_obra_id,item_ref,tipo_producao) where venda_obra_id is not null and item_ref is not null
    do update set setor_card_id=coalesce(excluded.setor_card_id,public.ordens_producao.setor_card_id),cliente_id=excluded.cliente_id,obra_id=excluded.obra_id,revisao_id=excluded.revisao_id,item_snapshot=excluded.item_snapshot,titulo=excluded.titulo,quantidade=excluded.quantidade,largura_mm=coalesce(excluded.largura_mm,public.ordens_producao.largura_mm),altura_mm=coalesce(excluded.altura_mm,public.ordens_producao.altura_mm),updated_at=now();
    v_total:=v_total+1;

    if v_tem_contramarco then
      insert into public.ordens_producao(setor_card_id,cliente_id,obra_id,venda_obra_id,orcamento_id,revisao_id,item_ref,item_snapshot,tipo_producao,titulo,quantidade,largura_mm,altura_mm,status,bloqueada,bloqueio_motivo,origem,criado_por_id,criado_por_nome)
      values(v_card_id,v_venda.cliente_id,v_venda.obra_id,v_venda.id,p_orcamento_id,v_revisao_id,v_ref,v_item,'contramarco','Contramarco — '||v_titulo,v_qtd,v_larg,v_alt,'liberada',false,null,'workflow',p_usuario_id,p_usuario_nome)
      on conflict (venda_obra_id,item_ref,tipo_producao) where venda_obra_id is not null and item_ref is not null
      do update set setor_card_id=coalesce(excluded.setor_card_id,public.ordens_producao.setor_card_id),cliente_id=excluded.cliente_id,obra_id=excluded.obra_id,revisao_id=excluded.revisao_id,item_snapshot=excluded.item_snapshot,titulo=excluded.titulo,quantidade=excluded.quantidade,largura_mm=coalesce(excluded.largura_mm,public.ordens_producao.largura_mm),altura_mm=coalesce(excluded.altura_mm,public.ordens_producao.altura_mm),status=case when public.ordens_producao.status='cancelada' then 'liberada' else public.ordens_producao.status end,bloqueada=case when public.ordens_producao.status='cancelada' then false else public.ordens_producao.bloqueada end,bloqueio_motivo=case when public.ordens_producao.status='cancelada' then null else public.ordens_producao.bloqueio_motivo end,updated_at=now();
      v_total:=v_total+1;
    else
      update public.ordens_producao set status='cancelada',bloqueada=true,bloqueio_motivo='Contramarco removido na versão atual do projeto',revisao_id=v_revisao_id,updated_at=now()
       where venda_obra_id=v_venda.id and item_ref=v_ref and tipo_producao='contramarco' and status not in ('concluida','cancelada');
    end if;
  end loop;
  return v_total;
end;
$$;
revoke execute on function public.fn_criar_ordens_producao_v1(uuid,uuid,text) from public,anon,authenticated;

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
declare v_venda public.vendas_obras%rowtype; v_antes jsonb; v_versao integer; v_id uuid; v_projeto_conferido boolean;
begin
  if length(trim(coalesce(p_justificativa,'')))<3 then raise exception 'Justificativa obrigatória para alteração pós-venda'; end if;
  if p_depois is null or jsonb_typeof(p_depois)<>'object' then raise exception 'Estado revisado inválido'; end if;
  select * into v_venda from public.vendas_obras where id=p_venda_obra_id for update;
  if not found then raise exception 'Venda não encontrada'; end if;
  v_antes:=public.fn_venda_estado_atual_v1(p_venda_obra_id);
  select coalesce(max(versao),v_venda.versao)+1 into v_versao from public.venda_obra_revisoes where venda_obra_id=p_venda_obra_id;
  insert into public.venda_obra_revisoes(venda_obra_id,versao,tipo,justificativa,antes,depois,impacto_valor,impacto_custo,criado_por_id,criado_por_nome)
  values(p_venda_obra_id,v_versao,'ajuste',p_justificativa,v_antes,p_depois,p_impacto_valor,p_impacto_custo,p_usuario_id,p_usuario_nome)
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

insert into public.workflow_automacoes(nome,evento_chave,acao_tipo,destino_setor_id,destino_coluna_id,notificar_responsavel,criar_tarefa,mensagem_template,ativo,ordem)
select 'Projeto conferido → Produção','projeto_conferido','criar_card_setor','producao',
       (select id from public.setor_kanban_colunas where setor_id='producao' order by ordem limit 1),
       true,false,'Projeto de {cliente} conferido. Ordem de Produção criada; itens ficam bloqueados/liberados conforme Medição Final e materiais.',true,50
where not exists(select 1 from public.workflow_automacoes where evento_chave='projeto_conferido' and acao_tipo='criar_card_setor' and destino_setor_id='producao');

update public.setores set ativo=true,rota='/producao',descricao='Kanban de Produção vinculado às ordens da obra e ao Plano de Corte.' where id='producao';

create or replace function public.workflow_ordens_producao_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_setor text;
begin
  if new.evento_chave<>'projeto_conferido' or new.orcamento_id is null then return new; end if;
  select destino_setor_id into v_setor from public.workflow_automacoes where id=new.automacao_id;
  if v_setor='producao' then perform public.fn_criar_ordens_producao_v1(new.orcamento_id,new.executado_por_id,new.executado_por_nome); end if;
  return new;
end;
$$;
drop trigger if exists trg_workflow_ordens_producao on public.workflow_execucoes;
create trigger trg_workflow_ordens_producao after insert on public.workflow_execucoes for each row execute function public.workflow_ordens_producao_trigger_v1();