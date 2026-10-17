-- CRM: vínculo explícito entre versões de orçamento e negociação.
-- Não altera orçamentos, Kanban, vendas, produção nem tabelas legadas.
begin;

create table public.crm_oportunidade_vinculos (
  orcamento_id uuid primary key references public.orcamentos(id) on delete cascade,
  ancora_orcamento_id uuid not null references public.orcamentos(id) on delete restrict,
  empresa_id uuid not null default private.current_empresa_id() references public.empresas(id),
  confirmado_por_id uuid not null references public.usuarios(id),
  confirmado_em timestamptz not null default now()
);
create index crm_oportunidade_vinculos_ancora_idx on public.crm_oportunidade_vinculos(empresa_id,ancora_orcamento_id);

-- Nunca misturar clientes, obras ou empresas. A associação de duas obras sem id fica bloqueada.
create function public.crm_validar_vinculo_oportunidade_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_origem record; v_ancora record;
begin
  select empresa_id,cliente_id,obra_id into v_origem from public.orcamentos where id=new.orcamento_id;
  select empresa_id,cliente_id,obra_id into v_ancora from public.orcamentos where id=new.ancora_orcamento_id;
  if v_origem.empresa_id is null or v_ancora.empresa_id is null
    or new.empresa_id is distinct from v_origem.empresa_id
    or v_origem.empresa_id is distinct from v_ancora.empresa_id then
    raise exception 'Vínculo inválido: empresa diferente ou orçamento ausente';
  end if;
  if new.orcamento_id<>new.ancora_orcamento_id
     and (v_origem.cliente_id is null or v_origem.obra_id is null
          or v_origem.cliente_id is distinct from v_ancora.cliente_id
          or v_origem.obra_id is distinct from v_ancora.obra_id) then
    raise exception 'Vínculo exige o mesmo cliente e a mesma obra identificados';
  end if;
  if new.confirmado_por_id is distinct from auth.uid() then
    raise exception 'O responsável pela confirmação deve ser o usuário autenticado';
  end if;
  return new;
end;
$$;
create trigger crm_validar_vinculo_oportunidade
before insert or update on public.crm_oportunidade_vinculos
for each row execute function public.crm_validar_vinculo_oportunidade_v1();

alter table public.crm_oportunidade_vinculos enable row level security;
revoke all on public.crm_oportunidade_vinculos from public,anon,authenticated;
grant select,insert,update on public.crm_oportunidade_vinculos to authenticated;

-- Checagem no banco: uma interface oculta não é controle de acesso.
create function private.pode_acessar_crm_vinculos_v1(p_edicao boolean)
returns boolean language sql stable security invoker set search_path='' as $$
  select (select private.is_master_atlas()) or exists (
    select 1 from public.permissoes p
    where p.usuario_id=(select auth.uid()) and p.setor_id='crm'
      and (p.nivel='edicao' or (not p_edicao and p.nivel='consulta'))
  );
$$;
revoke all on function private.pode_acessar_crm_vinculos_v1(boolean) from public,anon;
grant execute on function private.pode_acessar_crm_vinculos_v1(boolean) to authenticated;

-- Uma confirmação manual nunca dá acesso a orçamentos de outra empresa ou vendedor.
create policy crm_oportunidade_vinculos_select on public.crm_oportunidade_vinculos
for select to authenticated using (
  empresa_id=(select private.current_empresa_id())
  and (select private.pode_acessar_crm_vinculos_v1(false))
  and exists (
    select 1 from public.orcamentos o
    where o.id=orcamento_id and o.empresa_id=empresa_id
      and (o.criado_por_id=(select auth.uid()) or (select private.is_master_atlas()))
  )
);
create policy crm_oportunidade_vinculos_insert on public.crm_oportunidade_vinculos
for insert to authenticated with check (
  empresa_id=(select private.current_empresa_id())
  and (select private.pode_acessar_crm_vinculos_v1(true))
  and confirmado_por_id=(select auth.uid())
  and exists (
    select 1 from public.orcamentos o
    where o.id=orcamento_id and o.empresa_id=empresa_id
      and (o.criado_por_id=(select auth.uid()) or (select private.is_master_atlas()))
  )
);
create policy crm_oportunidade_vinculos_update on public.crm_oportunidade_vinculos
for update to authenticated using (
  empresa_id=(select private.current_empresa_id())
  and (select private.pode_acessar_crm_vinculos_v1(true))
  and exists (
    select 1 from public.orcamentos o
    where o.id=orcamento_id and o.empresa_id=empresa_id
      and (o.criado_por_id=(select auth.uid()) or (select private.is_master_atlas()))
  )
) with check (
  empresa_id=(select private.current_empresa_id())
  and (select private.pode_acessar_crm_vinculos_v1(true))
  and confirmado_por_id=(select auth.uid())
  and exists (
    select 1 from public.orcamentos o
    where o.id=orcamento_id and o.empresa_id=empresa_id
      and (o.criado_por_id=(select auth.uid()) or (select private.is_master_atlas()))
  )
);
commit;