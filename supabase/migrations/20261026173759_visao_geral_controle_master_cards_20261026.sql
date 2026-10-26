-- Kanban Geral / Cliente 360: exceções visuais auditadas, exclusivas do Master.
-- Não altera clientes, vendas, status operacionais nem documentos.
begin;

create table if not exists public.visao_geral_cards_controle (
 empresa_id uuid not null references public.empresas(id),
 venda_id uuid not null references public.vendas_obras(id),
 estado text not null check (estado in ('finalizado','oculto')),
 motivo text not null check (char_length(btrim(motivo)) between 8 and 1000),
 atualizado_por_id uuid not null references public.usuarios(id),
 updated_at timestamptz not null default now(),
 primary key (empresa_id,venda_id)
);
create index if not exists visao_geral_cards_controle_venda_idx
 on public.visao_geral_cards_controle(venda_id);

create table if not exists public.visao_geral_cards_historico (
 id bigint generated always as identity primary key,
 empresa_id uuid not null references public.empresas(id),
 venda_id uuid not null references public.vendas_obras(id),
 estado_anterior text,
 estado_novo text,
 motivo text not null,
 usuario_id uuid not null references public.usuarios(id),
 created_at timestamptz not null default now()
);
create index if not exists visao_geral_cards_historico_empresa_idx
 on public.visao_geral_cards_historico(empresa_id,created_at desc);

alter table public.visao_geral_cards_controle enable row level security;
alter table public.visao_geral_cards_historico enable row level security;
revoke all on public.visao_geral_cards_controle from PUBLIC,anon,authenticated;
revoke all on public.visao_geral_cards_historico from PUBLIC,anon,authenticated;
grant select,insert,update,delete on public.visao_geral_cards_controle to service_role;
grant select,insert on public.visao_geral_cards_historico to service_role;
grant usage,select on sequence public.visao_geral_cards_historico_id_seq to service_role;

create or replace function public.alterar_card_visao_geral_master_v1(
 p_empresa uuid, p_usuario uuid, p_venda uuid, p_acao text, p_motivo text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare anterior text;
declare novo_estado text;
declare motivo_valido text;
begin
 if not exists (select 1 from public.usuarios
    where id=p_usuario and empresa_id=p_empresa and lower(role)='master')
 then raise exception 'Somente o usuário Master pode finalizar ou excluir cards na Visão Geral'; end if;
 if not exists (select 1 from public.vendas_obras
    where id=p_venda and empresa_id=p_empresa)
 then raise exception 'Venda/obra não encontrada na empresa'; end if;
 if p_acao not in ('finalizar','ocultar','restaurar')
 then raise exception 'Ação inválida'; end if;
 motivo_valido=btrim(coalesce(p_motivo,''));
 if length(motivo_valido)<8 or length(motivo_valido)>1000
 then raise exception 'O motivo deve ter entre 8 e 1000 caracteres'; end if;
 select estado into anterior
  from public.visao_geral_cards_controle
  where empresa_id=p_empresa and venda_id=p_venda for update;
 if p_acao='restaurar' then
    delete from public.visao_geral_cards_controle where empresa_id=p_empresa and venda_id=p_venda;
    novo_estado=null;
 elsif p_acao='finalizar' then
    novo_estado='finalizado';
    insert into public.visao_geral_cards_controle
      (empresa_id,venda_id,estado,motivo,atualizado_por_id)
    values (p_empresa,p_venda,novo_estado,motivo_valido,p_usuario)
    on conflict (empresa_id,venda_id) do update
      set estado=excluded.estado,motivo=excluded.motivo,atualizado_por_id=excluded.atualizado_por_id,updated_at=now();
 else
    novo_estado='oculto';
    insert into public.visao_geral_cards_controle
      (empresa_id,venda_id,estado,motivo,atualizado_por_id)
    values (p_empresa,p_venda,novo_estado,motivo_valido,p_usuario)
    on conflict (empresa_id,venda_id) do update
      set estado=excluded.estado,motivo=excluded.motivo,atualizado_por_id=excluded.atualizado_por_id,updated_at=now();
 end if;
 insert into public.visao_geral_cards_historico
 (empresa_id,venda_id,estado_anterior,estado_novo,motivo,usuario_id)
 values (p_empresa,p_venda,anterior,novo_estado,motivo_valido,p_usuario);
 return jsonb_build_object('ok',true,'estado',novo_estado,'vendaId',p_venda);
end;$$;
revoke all on function public.alterar_card_visao_geral_master_v1(uuid,uuid,uuid,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.alterar_card_visao_geral_master_v1(uuid,uuid,uuid,text,text) to service_role;

commit;
