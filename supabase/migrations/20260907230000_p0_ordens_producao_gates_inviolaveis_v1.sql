begin;

-- Ordens de produção nunca podem atravessar empresas.
drop policy if exists ordens_producao_auth_all on public.ordens_producao;
create policy tenant_ordens_producao_select on public.ordens_producao for select
  using (empresa_id = (select private.current_empresa_id()));
create policy tenant_ordens_producao_insert on public.ordens_producao for insert
  with check (empresa_id = (select private.current_empresa_id()));
create policy tenant_ordens_producao_update on public.ordens_producao for update
  using (empresa_id = (select private.current_empresa_id()))
  with check (empresa_id = (select private.current_empresa_id()));
create policy tenant_ordens_producao_delete on public.ordens_producao for delete
  using (empresa_id = (select private.current_empresa_id()));

-- Uma OP de esquadria vinculada só pode operar depois da Medição Final aprovada
-- e das liberações de Perfis, Acessórios e Outros.
create or replace function private.guard_ordem_producao_liberacao_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_medicao_aprovada boolean;
  v_setores integer;
  v_todos_liberados boolean;
  v_operacional boolean;
begin
  if new.tipo_producao is distinct from 'esquadria' or new.orcamento_id is null then
    return new;
  end if;

  v_operacional := coalesce(new.bloqueada, false) = false
    or coalesce(new.status, 'aguardando') in ('liberada','em_producao','conferencia','concluida');

  if not v_operacional then
    return new;
  end if;

  select exists(
    select 1
    from public.medicoes_finais m
    where m.orcamento_id = new.orcamento_id
      and m.empresa_id = new.empresa_id
      and m.status_operacional = 'aprovado'
  ) into v_medicao_aprovada;

  select count(distinct c.setor_id),
         coalesce(bool_and(lower(c.nome) = 'liberado'), false)
    into v_setores, v_todos_liberados
    from public.setor_kanban_itens i
    join public.setor_kanban_colunas c on c.id = i.coluna_id
   where i.orcamento_id = new.orcamento_id
     and i.empresa_id = new.empresa_id
     and c.empresa_id = new.empresa_id
     and c.setor_id in ('compras-perfis','compras-acessorios','compras-outros');

  if not v_medicao_aprovada or v_setores <> 3 or not v_todos_liberados then
    raise exception 'Produção bloqueada: exige Medição Final aprovada e Perfis, Acessórios e Outros liberados.';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_ordem_producao_liberacao_v1() from public, anon, authenticated;
grant execute on function private.guard_ordem_producao_liberacao_v1() to service_role;

drop trigger if exists trg_ordem_producao_liberacao on public.ordens_producao;
create trigger trg_ordem_producao_liberacao
before insert or update of orcamento_id, empresa_id, tipo_producao, status, bloqueada
on public.ordens_producao
for each row execute function private.guard_ordem_producao_liberacao_v1();

commit;
