-- Data comercial da venda: independente da criação e da movimentação do card.
-- Não reescreve datas históricas; a referência anterior permanece como fallback.
begin;

alter table public.orcamentos add column if not exists data_venda date;
create index if not exists orcamentos_kanban_data_venda_idx
 on public.orcamentos(empresa_id,coluna_id,data_venda) where kanban_retirado_em is null;

create table if not exists public.kanban_comercial_datas_venda_auditoria (
 id bigint generated always as identity primary key,
 empresa_id uuid not null references public.empresas(id),
 orcamento_id uuid not null references public.orcamentos(id),
 usuario_id uuid not null references public.usuarios(id),
 data_anterior_explicita date,
 data_anterior_efetiva date not null,
 data_nova date not null,
 motivo text not null check(char_length(btrim(motivo)) between 8 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists kanban_comercial_datas_venda_auditoria_idx
 on public.kanban_comercial_datas_venda_auditoria(empresa_id,orcamento_id,created_at desc);
alter table public.kanban_comercial_datas_venda_auditoria enable row level security;
revoke all on public.kanban_comercial_datas_venda_auditoria from public,anon,authenticated;
grant select,insert on public.kanban_comercial_datas_venda_auditoria to service_role;
grant usage,select on sequence public.kanban_comercial_datas_venda_auditoria_id_seq to service_role;

-- Correções nunca devem ser feitas por PATCH direto no navegador.
create or replace function public.proteger_data_venda_comercial_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if current_user <> 'service_role' and old.data_venda is distinct from new.data_venda then
   raise exception 'A data de venda deve ser corrigida pelo fluxo autorizado do Kanban';
 end if;
 return new;
end;$$;
drop trigger if exists trg_proteger_data_venda_comercial_v1 on public.orcamentos;
create trigger trg_proteger_data_venda_comercial_v1
 before update of data_venda on public.orcamentos
 for each row execute function public.proteger_data_venda_comercial_v1();

-- Executada exclusivamente pela API autenticada via service_role.
-- Registro no histórico e alteração acontecem na MESMA transação.
create or replace function public.corrigir_data_venda_kanban_comercial_v1(
 p_empresa uuid,p_usuario uuid,p_orcamento uuid,p_data date,p_motivo text,p_data_esperada date
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 v_role text;
 v_config jsonb;
 v_nivel text;
 v_card public.orcamentos%rowtype;
 v_vendida boolean;
 v_anterior date;
 v_nome text;
begin
 if current_user <> 'service_role' then raise exception 'Operação exclusiva da API autenticada'; end if;
 if p_data is null or p_data > (now() at time zone 'America/Sao_Paulo')::date
 then raise exception 'Informe uma data de venda válida, não futura'; end if;
 if length(btrim(coalesce(p_motivo,''))) not between 8 and 1000
 then raise exception 'Informe o motivo da correção (8 a 1000 caracteres)'; end if;
 select lower(role),nome into v_role,v_nome from public.usuarios
  where id=p_usuario and empresa_id=p_empresa;
 if v_role is null then raise exception 'Usuário não autorizado nesta empresa'; end if;
 if v_role <> 'master' then
   select config into v_config from public.usuario_acessos_etapas
    where usuario_id=p_usuario and empresa_id=p_empresa;
   select nivel into v_nivel from public.permissoes
    where usuario_id=p_usuario and empresa_id=p_empresa and setor_id='fazer-orcamento-msanfyvj';
   if v_nivel is distinct from 'edicao'
     or coalesce(v_config #>> '{modulos,fazer-orcamento}','edicao') <> 'edicao'
     or v_config #>> '{acoes,comercial.orcamento.corrigir_data_venda}' is distinct from 'edicao'
   then raise exception 'Esta correção exige autorização nominal do Master'; end if;
 end if;
 select * into v_card from public.orcamentos
  where id=p_orcamento and empresa_id=p_empresa for update;
 if not found then raise exception 'Orçamento não encontrado nesta empresa'; end if;
 if v_card.kanban_retirado_em is not null then raise exception 'Card retirado não pode ser corrigido'; end if;
 select coalesce(gera_medicao_final,false) into v_vendida from public.kanban_colunas
  where id=v_card.coluna_id and empresa_id=p_empresa;
 if coalesce(v_vendida,false) is false then
   raise exception 'Somente cards na coluna Vendido permitem corrigir a data da venda';
 end if;
 v_anterior := coalesce(v_card.data_venda,
   (coalesce(v_card.coluna_atualizada_em,v_card.created_at) at time zone 'America/Sao_Paulo')::date);
 if v_anterior is null then raise exception 'Não foi possível determinar a data anterior'; end if;
 if p_data_esperada is distinct from v_anterior then raise exception 'A data foi alterada em outra sessão. Atualize o card antes de corrigir'; end if;
 if p_data=v_anterior then raise exception 'A data informada é igual à atual'; end if;
 update public.orcamentos set data_venda=p_data,updated_at=now()
  where id=p_orcamento and empresa_id=p_empresa;
 insert into public.kanban_comercial_datas_venda_auditoria
  (empresa_id,orcamento_id,usuario_id,data_anterior_explicita,data_anterior_efetiva,data_nova,motivo)
 values(p_empresa,p_orcamento,p_usuario,v_card.data_venda,v_anterior,p_data,btrim(p_motivo));
 insert into public.historico
  (empresa_id,orcamento_id,usuario_nome,usuario_id,acao,detalhes)
 values(p_empresa,p_orcamento,coalesce(v_nome,'Usuário'),p_usuario,
  'Corrigiu data da venda',to_char(v_anterior,'DD/MM/YYYY')||' → '||
  to_char(p_data,'DD/MM/YYYY')||' · Motivo: '||btrim(p_motivo));
 return jsonb_build_object('ok',true,'id',p_orcamento,
  'data_venda',p_data,'data_anterior',v_anterior);
end;$$;
revoke all on function public.corrigir_data_venda_kanban_comercial_v1(uuid,uuid,uuid,date,text,date)
 from public,anon,authenticated;
grant execute on function public.corrigir_data_venda_kanban_comercial_v1(uuid,uuid,uuid,date,text,date) to service_role;
-- Fonte única de competência para os relatórios, sem modificar confirmação financeira.
create or replace view public.vendas_obras_data_comercial
with (security_invoker = true) as
select
 v.id,v.empresa_id,v.orcamento_id,v.cliente_id,v.numero,v.status,
 v.valor_venda,v.custo_previsto,v.confirmado_em,v.excluida_em,
 coalesce(
   o.data_venda,
   (coalesce(o.coluna_atualizada_em,v.confirmado_em,v.created_at)
      at time zone 'America/Sao_Paulo')::date
 ) as data_comercial
from public.vendas_obras v
left join public.orcamentos o on o.id=v.orcamento_id and o.empresa_id=v.empresa_id;
revoke all on public.vendas_obras_data_comercial from public,anon,authenticated;
grant select on public.vendas_obras_data_comercial to service_role;

commit;
