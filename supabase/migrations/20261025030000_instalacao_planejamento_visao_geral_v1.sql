-- CANDIDATA, NÃO APLICADA: agenda financeira mensal de instalação (Atlas One).
-- Não altera ordens, calendários existentes, Cliente 360 nem estados de instalação.
begin;
create table if not exists public.instalacao_planejamento_metas (
 empresa_id uuid not null references public.empresas(id),
 mes date not null check (extract(day from mes)=1),
 meta_valor numeric(14,2) not null check(meta_valor>0),
 atualizado_por_id uuid not null references public.usuarios(id),
 updated_at timestamptz not null default now(),
 primary key(empresa_id,mes)
);
create table if not exists public.instalacao_planejamento_reservas (
 id uuid primary key default gen_random_uuid(),
 empresa_id uuid not null references public.empresas(id),
 venda_obra_id uuid not null references public.vendas_obras(id),
 data_prevista date not null,
 valor_programado numeric(14,2) not null check (valor_programado>0),
 estado text not null default 'previsto' check(estado in ('previsto','confirmado','concluido','cancelado')),
 observacoes text,
 atualizado_por_id uuid not null references public.usuarios(id),
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(empresa_id,venda_obra_id)
);
create index if not exists instalacao_planejamento_periodo_idx
 on public.instalacao_planejamento_reservas(empresa_id,data_prevista,estado);
create table if not exists public.instalacao_planejamento_auditoria (
 id bigint generated always as identity primary key,
 empresa_id uuid not null references public.empresas(id),
 referencia_id uuid,
 operacao text not null check(operacao in ('meta','reserva')),
 antes jsonb,depois jsonb,
 justificativa text,
 usuario_id uuid not null references public.usuarios(id),
 created_at timestamptz not null default now()
);
create index if not exists instalacao_planejamento_auditoria_empresa_idx
 on public.instalacao_planejamento_auditoria(empresa_id,created_at desc);
alter table public.instalacao_planejamento_metas enable row level security;
alter table public.instalacao_planejamento_reservas enable row level security;
alter table public.instalacao_planejamento_auditoria enable row level security;
-- Nenhuma política de acesso direto; leitura/escrita só no servidor com autenticação Master.
revoke all on public.instalacao_planejamento_metas from PUBLIC,anon,authenticated;
revoke all on public.instalacao_planejamento_reservas from PUBLIC,anon,authenticated;
revoke all on public.instalacao_planejamento_auditoria from PUBLIC,anon,authenticated;
grant select,insert,update,delete on public.instalacao_planejamento_metas to service_role;
grant select,insert,update,delete on public.instalacao_planejamento_reservas to service_role;
grant select,insert on public.instalacao_planejamento_auditoria to service_role;
grant usage,select on sequence public.instalacao_planejamento_auditoria_id_seq to service_role;
-- Atualização da meta e auditoria na MESMA transação.
create or replace function public.registrar_meta_instalacao_v1(
 p_empresa uuid,p_usuario uuid,p_mes date,p_valor numeric
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare anterior public.instalacao_planejamento_metas%rowtype;
atual public.instalacao_planejamento_metas%rowtype;
begin
 if p_valor is null or p_valor<=0 or p_mes is null or extract(day from p_mes)<>1
 then raise exception 'Meta mensal inválida';end if;
 if not exists(select 1 from public.usuarios where id=p_usuario and empresa_id=p_empresa and role='master')
 then raise exception 'Somente Master altera metas';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_empresa::text),20261025);
 select * into anterior from public.instalacao_planejamento_metas where empresa_id=p_empresa and mes=p_mes;
 insert into public.instalacao_planejamento_metas(empresa_id,mes,meta_valor,atualizado_por_id)
 values(p_empresa,p_mes,p_valor,p_usuario)
 on conflict(empresa_id,mes) do update set meta_valor=excluded.meta_valor,atualizado_por_id=excluded.atualizado_por_id,updated_at=now()
 returning * into atual;
 insert into public.instalacao_planejamento_auditoria(empresa_id,operacao,antes,depois,usuario_id)
 values(p_empresa,'meta',case when anterior.empresa_id is null then null else to_jsonb(anterior) end,to_jsonb(atual),p_usuario);
 return jsonb_build_object('ok',true,'meta',atual.meta_valor);
end; $$;
-- Planejamento por obra, não confirma execução física da instalação.
create or replace function public.programar_instalacao_financeira_v1(
 p_empresa uuid,p_usuario uuid,p_venda uuid,p_data date,p_valor numeric,
 p_estado text default 'previsto',p_justificativa text default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare anterior public.instalacao_planejamento_reservas%rowtype;
atual public.instalacao_planejamento_reservas%rowtype;
meta numeric;ocupado numeric;excede boolean;
begin
 if p_data is null or p_valor is null or p_valor<=0 or (p_estado is null or p_estado not in ('previsto','confirmado'))
 then raise exception 'Programação inválida';end if;
 if not exists(select 1 from public.usuarios where id=p_usuario and empresa_id=p_empresa and role='master')
 then raise exception 'Somente Master administra capacidade';end if;
 if not exists(select 1 from public.vendas_obras where id=p_venda and empresa_id=p_empresa and status<>'cancelada')
 then raise exception 'Venda não vinculada à empresa';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_empresa::text),20261025);
 select * into anterior from public.instalacao_planejamento_reservas where empresa_id=p_empresa and venda_obra_id=p_venda;
 select meta_valor into meta from public.instalacao_planejamento_metas where empresa_id=p_empresa and mes=date_trunc('month',p_data)::date;
 select coalesce(sum(valor_programado),0) into ocupado from public.instalacao_planejamento_reservas
 where empresa_id=p_empresa and venda_obra_id<>p_venda and estado<>'cancelado'
 and data_prevista>=date_trunc('month',p_data)::date
 and data_prevista<(date_trunc('month',p_data)+interval '1 month')::date;
 excede:=meta is not null and ocupado+p_valor>meta;
 if excede and length(trim(coalesce(p_justificativa,'')))<8
 then raise exception 'Capacidade mensal excedida: escolha outra data ou registre justificativa Master.';end if;
 insert into public.instalacao_planejamento_reservas(empresa_id,venda_obra_id,data_prevista,valor_programado,estado,atualizado_por_id)
 values(p_empresa,p_venda,p_data,p_valor,p_estado,p_usuario)
 on conflict(empresa_id,venda_obra_id) do update set
 data_prevista=excluded.data_prevista,valor_programado=excluded.valor_programado,
 estado=excluded.estado,atualizado_por_id=excluded.atualizado_por_id,updated_at=now()
 returning * into atual;
 insert into public.instalacao_planejamento_auditoria(empresa_id,referencia_id,operacao,antes,depois,justificativa,usuario_id)
 values(p_empresa,atual.id,'reserva',case when anterior.id is null then null else to_jsonb(anterior) end,
 to_jsonb(atual),nullif(trim(p_justificativa),''),p_usuario);
 return jsonb_build_object('ok',true,'excedeuMeta',excede,'reserva',atual.id,'valorProgramado',ocupado+p_valor);
end; $$;
revoke all on function public.registrar_meta_instalacao_v1(uuid,uuid,date,numeric) from PUBLIC,anon,authenticated;
revoke all on function public.programar_instalacao_financeira_v1(uuid,uuid,uuid,date,numeric,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.registrar_meta_instalacao_v1(uuid,uuid,date,numeric) to service_role;
grant execute on function public.programar_instalacao_financeira_v1(uuid,uuid,uuid,date,numeric,text,text) to service_role;
commit;
