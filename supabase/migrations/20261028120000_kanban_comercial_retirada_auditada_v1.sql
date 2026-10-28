-- Exclusão lógica de cards comerciais: mantém orçamentos, clientes, anexos e histórico.
-- Somente a API autenticada (service_role) pode retirar/restaurar, sob permissão nominal do Master.
begin;

alter table public.orcamentos add column if not exists kanban_retirado_em timestamptz;
alter table public.orcamentos add column if not exists kanban_retirado_por_id uuid;
alter table public.orcamentos add column if not exists kanban_retirado_motivo text;
create index if not exists orcamentos_kanban_etapa_mes_idx
 on public.orcamentos(empresa_id,coluna_id,coluna_atualizada_em) where kanban_retirado_em is null;
create index if not exists orcamentos_kanban_retirados_empresa_idx
 on public.orcamentos(empresa_id,kanban_retirado_em) where kanban_retirado_em is not null;

create table if not exists public.kanban_comercial_cards_auditoria (
 id bigint generated always as identity primary key,
 empresa_id uuid not null,
 orcamento_id uuid not null references public.orcamentos(id),
 acao text not null check(acao in ('retirar','restaurar')),
 motivo text not null check(char_length(btrim(motivo)) between 8 and 1000),
 usuario_id uuid not null references public.usuarios(id),
 cliente_nome text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists kanban_comercial_cards_auditoria_empresa_idx
 on public.kanban_comercial_cards_auditoria(empresa_id,orcamento_id,created_at desc);
alter table public.kanban_comercial_cards_auditoria enable row level security;
revoke all on public.kanban_comercial_cards_auditoria from public,anon,authenticated;
grant select,insert on public.kanban_comercial_cards_auditoria to service_role;
grant usage,select on sequence public.kanban_comercial_cards_auditoria_id_seq to service_role;

-- Proíbe manipulação dos campos de retirada pelo cliente Supabase direto.
create or replace function public.proteger_retirada_kanban_comercial_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if current_user <> 'service_role' and (
    old.kanban_retirado_em is distinct from new.kanban_retirado_em
    or old.kanban_retirado_por_id is distinct from new.kanban_retirado_por_id
    or old.kanban_retirado_motivo is distinct from new.kanban_retirado_motivo
 ) then
   raise exception 'Retirada de cards só pode ocorrer pela autorização do Kanban comercial';
 end if;
 return new;
end;$$;
drop trigger if exists trg_proteger_retirada_kanban_comercial_v1 on public.orcamentos;
create trigger trg_proteger_retirada_kanban_comercial_v1
 before update of kanban_retirado_em,kanban_retirado_por_id,kanban_retirado_motivo
 on public.orcamentos for each row execute function public.proteger_retirada_kanban_comercial_v1();

create or replace function public.alterar_card_kanban_comercial_v1(
 p_empresa uuid,p_usuario uuid,p_orcamento uuid,p_acao text,p_motivo text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 v_role text;
 v_config jsonb;
 v_nivel text;
 v_card public.orcamentos%rowtype;
 v_coluna_nome text;
 v_acao text;
begin
 if p_acao not in ('retirar','restaurar') then raise exception 'Ação inválida'; end if;
 if char_length(btrim(coalesce(p_motivo,''))) not between 8 and 1000
 then raise exception 'Informe um motivo de 8 a 1000 caracteres'; end if;
 select lower(role) into v_role from public.usuarios where id=p_usuario and empresa_id=p_empresa;
 if v_role is null then raise exception 'Usuário não autorizado nesta empresa'; end if;
 if v_role <> 'master' then
   select config into v_config from public.usuario_acessos_etapas
    where usuario_id=p_usuario and empresa_id=p_empresa;
   select nivel into v_nivel from public.permissoes
    where usuario_id=p_usuario and empresa_id=p_empresa and setor_id='fazer-orcamento-msanfyvj';
   v_acao=case when p_acao='retirar' then 'comercial.orcamento.retirar_card'
    else 'comercial.orcamento.restaurar_card' end;
   if v_nivel is distinct from 'edicao'
     or coalesce(v_config #>> '{modulos,fazer-orcamento}','edicao') <> 'edicao'
     or v_config #>> array['acoes',v_acao] is distinct from 'edicao'
   then raise exception 'Essa ação precisa de autorização específica do Master'; end if;
 end if;
 select * into v_card from public.orcamentos
  where id=p_orcamento and empresa_id=p_empresa for update;
 if not found then raise exception 'Orçamento não encontrado nesta empresa'; end if;
 if p_acao='retirar' then
   if v_card.kanban_retirado_em is not null then raise exception 'Card já retirado'; end if;
   if exists(select 1 from public.vendas_obras where empresa_id=p_empresa and orcamento_id=p_orcamento)
   then raise exception 'Orçamento vinculado a venda não pode ser retirado. Faça a correção no fluxo de vendas.'; end if;
   select nome into v_coluna_nome from public.kanban_colunas
    where empresa_id=p_empresa and id=v_card.coluna_id;
   if lower(coalesce(v_coluna_nome,'')) like '%vendido%'
   then raise exception 'Card na etapa Vendido não pode ser retirado'; end if;
   update public.orcamentos set kanban_retirado_em=now(),kanban_retirado_por_id=p_usuario,
     kanban_retirado_motivo=btrim(p_motivo)
    where id=p_orcamento and empresa_id=p_empresa;
 else
   if v_card.kanban_retirado_em is null then raise exception 'Card não está retirado'; end if;
   update public.orcamentos set kanban_retirado_em=null,kanban_retirado_por_id=null,
     kanban_retirado_motivo=null
    where id=p_orcamento and empresa_id=p_empresa;
 end if;
 insert into public.kanban_comercial_cards_auditoria
  (empresa_id,orcamento_id,acao,motivo,usuario_id,cliente_nome)
 values(p_empresa,p_orcamento,p_acao,btrim(p_motivo),p_usuario,coalesce(v_card.cliente_nome,''));
 return jsonb_build_object('ok',true,'id',p_orcamento,'acao',p_acao);
end;$$;
revoke all on function public.alterar_card_kanban_comercial_v1(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.alterar_card_kanban_comercial_v1(uuid,uuid,uuid,text,text) to service_role;
commit;
