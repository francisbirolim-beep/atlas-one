-- Exclusão lógica de venda individual; preserva vínculo W.Vetro e histórico para impedir recriação.
-- Executar antes do release da interface. Nenhum registro existente é alterado nesta migração.
begin;

alter table public.vendas_obras
 add column if not exists excluida_em timestamptz,
 add column if not exists excluida_por_id uuid,
 add column if not exists excluida_motivo text;
create index if not exists vendas_obras_ativas_empresa_cliente_idx
 on public.vendas_obras(empresa_id,cliente_id,confirmado_em desc) where excluida_em is null;

create table if not exists public.venda_exclusoes_auditoria (
 id bigint generated always as identity primary key,
 empresa_id uuid not null,
 venda_obra_id uuid not null references public.vendas_obras(id) on delete restrict,
 cliente_id uuid not null,
 numero_venda bigint,
 status_anterior text not null,
 valor_venda numeric(14,2),
 motivo text not null check(char_length(btrim(motivo)) between 8 and 1000),
 usuario_id uuid not null references public.usuarios(id),
 usuario_nome text not null,
 contas_canceladas integer not null default 0,
 created_at timestamptz not null default now(),
 unique(venda_obra_id)
);
alter table public.venda_exclusoes_auditoria enable row level security;
revoke all on public.venda_exclusoes_auditoria from public,anon,authenticated;
grant select,insert on public.venda_exclusoes_auditoria to service_role;
grant usage,select on sequence public.venda_exclusoes_auditoria_id_seq to service_role;

create or replace function public.proteger_exclusao_direta_venda_v1()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if current_user <> 'service_role' and (
  old.excluida_em is distinct from new.excluida_em
  or old.excluida_por_id is distinct from new.excluida_por_id
  or old.excluida_motivo is distinct from new.excluida_motivo
 ) then raise exception 'Exclusão de venda exige autorização do Master'; end if;
 if old.excluida_em is not null and new.status is distinct from old.status then
  raise exception 'Venda excluída não pode ser reativada por sincronização'; end if;
 return new;
end;$$;
drop trigger if exists trg_proteger_exclusao_direta_venda_v1 on public.vendas_obras;
create trigger trg_proteger_exclusao_direta_venda_v1
 before update of excluida_em,excluida_por_id,excluida_motivo,status
 on public.vendas_obras for each row execute function public.proteger_exclusao_direta_venda_v1();

create or replace function public.excluir_venda_incorreta_v1(
 p_empresa uuid,p_usuario uuid,p_venda uuid,p_motivo text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 v_role text; v_nome text; v_venda public.vendas_obras%rowtype;
 v_contas_canceladas integer := 0;
begin
 if char_length(btrim(coalesce(p_motivo,''))) not between 8 and 1000 then
  raise exception 'Informe motivo entre 8 e 1000 caracteres'; end if;
 select role,nome into v_role,v_nome from public.usuarios
  where id=p_usuario and empresa_id=p_empresa;
 if v_role is distinct from 'master' then
  raise exception 'Somente o Master pode excluir vendas'; end if;
 select * into v_venda from public.vendas_obras
  where id=p_venda and empresa_id=p_empresa for update;
 if not found then raise exception 'Venda não localizada nesta empresa'; end if;
 if v_venda.excluida_em is not null then raise exception 'Venda já excluída'; end if;
 if v_venda.status='concluida' then
  raise exception 'Venda concluída exige revisão administrativa antes da exclusão'; end if;

 -- Nada que tenha movimentação de produção, compra ou instalação é cancelado automaticamente.
 if exists(select 1 from public.ordens_producao where venda_obra_id=p_venda and empresa_id=p_empresa)
 or exists(select 1 from public.venda_cotacao_lotes where venda_obra_id=p_venda and empresa_id=p_empresa)
 or exists(select 1 from public.venda_instalacao_itens where venda_obra_id=p_venda and empresa_id=p_empresa)
 then raise exception 'Venda possui produção, cotação ou instalação vinculada. Regularize antes de excluir'; end if;

 -- Contas já pagas ou com alocações exigem correção financeira específica.
 if exists(select 1 from public.financeiro_contas_receber f
   where f.venda_obra_id=p_venda and f.empresa_id=p_empresa
   and (coalesce(f.valor_pago,0) <> 0 or f.status='pago'
    or exists(select 1 from public.financeiro_recebimento_alocacoes a where a.conta_receber_id=f.id)))
 then raise exception 'Há recebimento ou movimentação financeira. Corrija no Financeiro antes de excluir'; end if;
 if exists(select 1 from public.financeiro_contas_receber f
   where f.venda_obra_id=p_venda and f.empresa_id=p_empresa and f.status<>'cancelado'
     and (coalesce(f.orcamento_id,'00000000-0000-0000-0000-000000000000'::uuid) <> v_venda.orcamento_id
       or coalesce(f.observacoes,'') not like 'Pré-lançamento criado pela automação Venda confirmada%'))
 then raise exception 'Há lançamento financeiro manual vinculado. Regularize antes de excluir'; end if;

 -- Apenas o pré-lançamento automático sem recebimento será cancelado, nunca apagado.
 update public.financeiro_contas_receber
 set status='cancelado',updated_at=now(),
     observacoes=concat_ws(E'\n',nullif(observacoes,''),'[Atlas] Cancelada por exclusão auditada de venda incorreta.')
 where empresa_id=p_empresa and venda_obra_id=p_venda and status<>'cancelado';
 get diagnostics v_contas_canceladas = row_count;

 update public.vendas_obras
 set status='cancelada',excluida_em=now(),excluida_por_id=p_usuario,
     excluida_motivo=btrim(p_motivo),updated_at=now()
 where id=p_venda and empresa_id=p_empresa;

 insert into public.venda_exclusoes_auditoria
 (empresa_id,venda_obra_id,cliente_id,numero_venda,status_anterior,valor_venda,
  motivo,usuario_id,usuario_nome,contas_canceladas)
 values (p_empresa,p_venda,v_venda.cliente_id,v_venda.numero,v_venda.status,
  v_venda.valor_venda,btrim(p_motivo),p_usuario,coalesce(v_nome,'Master'),v_contas_canceladas);

 return jsonb_build_object('ok',true,'vendaId',p_venda,'contasCanceladas',v_contas_canceladas);
end;$$;
revoke all on function public.excluir_venda_incorreta_v1(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.excluir_venda_incorreta_v1(uuid,uuid,uuid,text) to service_role;
commit;
