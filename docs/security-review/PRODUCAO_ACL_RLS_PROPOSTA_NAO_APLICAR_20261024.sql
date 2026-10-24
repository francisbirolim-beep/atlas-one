-- ATLAS ONE / PRÉVIA DE HARDENING / 24-10-2026
-- NÃO APLICAR EM PRODUÇÃO: necessita teste PostgreSQL de integração e plano de rollback.
-- A chave por empresa fica DESLIGADA por padrão; ativação é exclusivamente via service_role.
-- Preserva as RPCs oficiais, automações e serviço administrativo antes da homologação.
begin;

create table if not exists public.atlas_producao_acl_rollout (
 empresa_id uuid primary key references public.empresas(id),
 habilitada boolean not null default false,
 atualizado_em timestamptz not null default now()
);
alter table public.atlas_producao_acl_rollout enable row level security;
revoke all on public.atlas_producao_acl_rollout from public,anon,authenticated;
grant select,insert,update,delete on public.atlas_producao_acl_rollout to service_role;

create or replace function private.atlas_producao_acl_ativa_v1(p_empresa uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.atlas_producao_acl_rollout
   where empresa_id=p_empresa and habilitada=true)
$$;
revoke all on function private.atlas_producao_acl_ativa_v1(uuid) from public,anon;
grant execute on function private.atlas_producao_acl_ativa_v1(uuid) to authenticated,service_role;

-- A API do Atlas só pode autorizar acesso de sua própria empresa.
-- Ausência de ação individual HERDA o setor, exceto as delegações sensíveis do CMV,
-- que NÃO são abrangidas por esta função.
create or replace function private.atlas_usuario_pode_producao_v1(p_acao text,p_minimo text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_empresa uuid;v_usuario uuid;v_setor text;v_acao text;v_config jsonb;
begin
 v_usuario:=auth.uid();v_empresa:=private.current_empresa_id();
 if v_usuario is null or v_empresa is null then return false;end if;
 if not exists(select 1 from public.usuarios
   where id=v_usuario and empresa_id=v_empresa)then return false;end if;
 if private.is_master_atlas() then return true;end if;
 select nivel into v_setor from public.permissoes
   where usuario_id=v_usuario and empresa_id=v_empresa and setor_id='producao';
 if v_setor not in ('consulta','edicao') or v_setor is null then return false;end if;
 select config into v_config from public.usuario_acessos_etapas
   where usuario_id=v_usuario and empresa_id=v_empresa;
 v_acao:=v_config->'acoes'->>p_acao;
 if v_acao is null then v_acao:=v_setor;end if;
 if p_minimo='edicao' then return v_setor='edicao' and v_acao='edicao';end if;
 if p_minimo='consulta' then return v_acao in ('consulta','edicao');end if;
 return false;
end;$$;
revoke all on function private.atlas_usuario_pode_producao_v1(text,text) from public,anon;
grant execute on function private.atlas_usuario_pode_producao_v1(text,text) to authenticated,service_role;

-- Restrição ADITIVA sobre a RLS já existente; jamais remove outras políticas.
-- A avaliação fica transparente para empresas não homologadas.
create policy atlas_producao_ordens_select_restritivo_v1
on public.ordens_producao as restrictive for select to authenticated
using (
 not private.atlas_producao_acl_ativa_v1(empresa_id)
 or private.atlas_usuario_pode_producao_v1('producao.geral.consultar','consulta')
);

-- O trigger trata DML direta no navegador, sem alterar os processos via service_role.
create or replace function private.atlas_producao_ordens_guard_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_empresa uuid;
begin
 v_empresa:=case when tg_op='DELETE' then old.empresa_id else new.empresa_id end;
 if auth.role()='service_role'
    or not private.atlas_producao_acl_ativa_v1(v_empresa) then
   return case when tg_op='DELETE' then old else new end;
 end if;
 if v_empresa is distinct from private.current_empresa_id() then
  raise exception 'Empresa da ordem não autorizada' using errcode='42501';
 end if;
 if tg_op='INSERT' then
  if not private.atlas_usuario_pode_producao_v1('producao.geral.criar','edicao') then
   raise exception 'Sem permissão para criar ordem' using errcode='42501';
  end if;
 elsif tg_op='UPDATE' then
  if new.empresa_id is distinct from old.empresa_id then
   raise exception 'Empresa da ordem imutável' using errcode='42501';
  end if;
  if new.status is distinct from old.status or new.bloqueada is distinct from old.bloqueada then
   if not private.atlas_usuario_pode_producao_v1('producao.geral.mover','edicao') then
    raise exception 'Sem permissão para mudar etapa' using errcode='42501';
   end if;
   if (new.status='liberada' and old.status is distinct from 'liberada')
     or (new.bloqueada=false and old.bloqueada=true) then
    if not private.atlas_usuario_pode_producao_v1('producao.geral.liberar','edicao') then
     raise exception 'Sem permissão para liberar ordem' using errcode='42501';
    end if;
   end if;
  end if;
  if (to_jsonb(new)-array['status','bloqueada','updated_at']) is distinct from
     (to_jsonb(old)-array['status','bloqueada','updated_at']) then
   if not private.atlas_usuario_pode_producao_v1('producao.geral.editar','edicao') then
    raise exception 'Sem permissão para editar ordem' using errcode='42501';
   end if;
  end if;
 elsif tg_op='DELETE' then
  if not private.is_master_atlas() then
   raise exception 'Excluir ordem exige Master' using errcode='42501';
  end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end;$$;
revoke all on function private.atlas_producao_ordens_guard_v1() from public,anon,authenticated;
drop trigger if exists trg_atlas_producao_ordens_guard_v1 on public.ordens_producao;
create trigger trg_atlas_producao_ordens_guard_v1
before insert or update or delete on public.ordens_producao
for each row execute function private.atlas_producao_ordens_guard_v1();

-- O verificador de origem do card usa SECURITY DEFINER para não depender
-- da política SELECT das colunas (evita falso NOT EXISTS em uma coluna oculta).
create or replace function private.atlas_card_eh_producao_v1(p_coluna uuid,p_empresa uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.setor_kanban_colunas
 where id=p_coluna and empresa_id=p_empresa and setor_id='producao')
$$;
revoke all on function private.atlas_card_eh_producao_v1(uuid,uuid) from public,anon;
grant execute on function private.atlas_card_eh_producao_v1(uuid,uuid) to authenticated,service_role;

-- Cards/colunas: RLS restritiva de leitura em quadros de produção; outros setores não mudam.
create policy atlas_producao_colunas_select_restritivo_v1
on public.setor_kanban_colunas as restrictive for select to authenticated
using (
 setor_id<>'producao'
 or not private.atlas_producao_acl_ativa_v1(empresa_id)
 or private.atlas_usuario_pode_producao_v1('producao.geral.consultar','consulta')
);
create policy atlas_producao_cards_select_restritivo_v1
on public.setor_kanban_itens as restrictive for select to authenticated
using (
 not private.atlas_producao_acl_ativa_v1(empresa_id)
 or not private.atlas_card_eh_producao_v1(coluna_id,empresa_id)
 or private.atlas_usuario_pode_producao_v1('producao.geral.consultar','consulta')
);

-- Observação: os triggers de DML de cards e colunas somente devem ser criados
-- após validar em banco clone a ordem de execução com:
-- trg_setor_item_contexto_orcamento_v1, trg_gates_card_material,
-- trg_registrar_movimento_setor_v1 e as RPCs de medição.
-- Especialmente, criar colunas padrão em GET não pode ser bloqueado para usuários só-consulta.
-- É obrigatório extrair primeiro as gravações de UI para rotas/RPCs autenticadas.

commit;

-- Ativação propositalmente AUSENTE. Nenhuma empresa é marcada como habilitada.
-- Só aplicar após: pg_policies/pg_trigger conferidos, usuários de teste,
-- casos 401/403, chamada JWT direta, rollback, automações e latência.
