-- CANDIDATA, NÃO APLICADA: configuração visual do Kanban Geral por empresa.
-- Persistência independente dos quadros operacionais e das suas posições.
begin;
create table if not exists public.visao_geral_configuracoes (
 empresa_id uuid primary key references public.empresas(id),
 colunas jsonb not null check(jsonb_typeof(colunas)='array'),
 atualizado_por_id uuid not null references public.usuarios(id),
 updated_at timestamptz not null default now()
);
create table if not exists public.visao_geral_configuracoes_historico (
 id bigint generated always as identity primary key,
 empresa_id uuid not null references public.empresas(id),
 antes jsonb,depois jsonb not null,
 usuario_id uuid not null references public.usuarios(id),
 created_at timestamptz not null default now()
);
create index if not exists visao_geral_configuracoes_historico_empresa_idx
 on public.visao_geral_configuracoes_historico(empresa_id,created_at desc);
alter table public.visao_geral_configuracoes enable row level security;
alter table public.visao_geral_configuracoes_historico enable row level security;
revoke all on public.visao_geral_configuracoes from PUBLIC,anon,authenticated;
revoke all on public.visao_geral_configuracoes_historico from PUBLIC,anon,authenticated;
grant select,insert,update on public.visao_geral_configuracoes to service_role;
grant select,insert on public.visao_geral_configuracoes_historico to service_role;
grant usage,select on sequence public.visao_geral_configuracoes_historico_id_seq to service_role;
-- Um Master salva TODOS os vínculos de etapas em transação única, sem tocar nos cards.
create or replace function public.salvar_visao_geral_colunas_v1(
 p_empresa uuid,p_usuario uuid,p_colunas jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare anterior public.visao_geral_configuracoes%rowtype;
atual public.visao_geral_configuracoes%rowtype;
esperadas text[]:=array[
 'vendido','conferir_projeto','separacao_materiais','medicao_final',
 'compras_liberacao','compras','aguardando_materiais','aguardando_producao',
 'producao','aguardando_instalacao','instalacao','finalizado'];
qtd integer;codigos integer;ordens integer;etapas integer;etapas_distintas integer;
begin
 if not exists(select 1 from public.usuarios where id=p_usuario and empresa_id=p_empresa and role='master')
 then raise exception 'Somente Master configura as colunas';end if;
 if p_colunas is null or jsonb_typeof(p_colunas)<>'array' then raise exception 'Configuração inválida';end if;
 qtd:=jsonb_array_length(p_colunas);
 if qtd<1 or qtd>30 then raise exception 'Quantidade de colunas inválida';end if;
 select count(distinct x.id),count(distinct x.ordem) into codigos,ordens
 from jsonb_to_recordset(p_colunas) as x(id text,nome text,ordem int,criterios jsonb,"prazoDias" int);
 if codigos<>qtd or ordens<>qtd then raise exception 'Colunas ou ordens duplicadas';end if;
 if exists(select 1 from jsonb_to_recordset(p_colunas) as x(id text,nome text,ordem int,criterios jsonb,"prazoDias" int)
 where trim(coalesce(x.id,''))='' or length(trim(coalesce(x.nome,'')))<1 or length(x.nome)>70
 or x.ordem<0 or x.ordem is null or jsonb_typeof(x.criterios)<>'array'
 or (x."prazoDias" is not null and (x."prazoDias"<0 or x."prazoDias">3650)))
 then raise exception 'Coluna malformada';end if;
 with todos as (
 select jsonb_array_elements_text(x.criterios) as etapa
 from jsonb_to_recordset(p_colunas) as x(id text,nome text,ordem int,criterios jsonb)
 ) select count(*),count(distinct etapa) into etapas,etapas_distintas from todos;
 if etapas<>array_length(esperadas,1) or etapas_distintas<>array_length(esperadas,1)
 or exists(with todos as (select jsonb_array_elements_text(x.criterios) as etapa
   from jsonb_to_recordset(p_colunas) as x(criterios jsonb))
   select 1 from todos where not (etapa=any(esperadas)))
 then raise exception 'Cada etapa operacional precisa de um único vínculo';end if;
 select * into anterior from public.visao_geral_configuracoes where empresa_id=p_empresa;
 insert into public.visao_geral_configuracoes(empresa_id,colunas,atualizado_por_id)
 values(p_empresa,p_colunas,p_usuario)
 on conflict(empresa_id) do update set colunas=excluded.colunas,atualizado_por_id=excluded.atualizado_por_id,updated_at=now()
 returning * into atual;
 insert into public.visao_geral_configuracoes_historico(empresa_id,antes,depois,usuario_id)
 values(p_empresa,case when anterior.empresa_id is null then null else anterior.colunas end,atual.colunas,p_usuario);
 return jsonb_build_object('ok',true,'colunas',atual.colunas);
end; $$;
revoke all on function public.salvar_visao_geral_colunas_v1(uuid,uuid,jsonb) from PUBLIC,anon,authenticated;
grant execute on function public.salvar_visao_geral_colunas_v1(uuid,uuid,jsonb) to service_role;
commit;
