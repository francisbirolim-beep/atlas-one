-- Atlas One — edição manual de materiais por tipologia.
-- Toda alteração manual registrada em override invalida a validação técnica do item.
-- O histórico de overrides passa a ser append-only para usuários autenticados.

create or replace function private.orcamento_override_marcar_pendente_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
  v_motivo text;
begin
  select o.empresa_id
    into v_empresa
    from public.orcamentos o
   where o.id = new.orcamento_id;

  if v_empresa is null then
    raise exception 'Orçamento do override não encontrado ou sem empresa';
  end if;

  if new.empresa_id is distinct from v_empresa then
    raise exception 'Override pertence a empresa diferente do orçamento';
  end if;

  v_motivo := format(
    'Alteração manual de %s (%s) aguardando validação técnica.',
    new.componente_tipo,
    new.acao
  );

  insert into public.orcamento_item_precificacao(
    empresa_id,
    orcamento_id,
    item_ref,
    situacao_tecnica,
    situacao_tecnica_motivo,
    validado_tecnicamente_em,
    validado_tecnicamente_por_id,
    validado_tecnicamente_por_nome
  ) values (
    v_empresa,
    new.orcamento_id,
    new.item_ref,
    'pendente_validacao',
    v_motivo,
    null,
    null,
    null
  )
  on conflict (orcamento_id, item_ref) do update
     set situacao_tecnica = 'pendente_validacao',
         situacao_tecnica_motivo = excluded.situacao_tecnica_motivo,
         validado_tecnicamente_em = null,
         validado_tecnicamente_por_id = null,
         validado_tecnicamente_por_nome = null,
         updated_at = now()
   where public.orcamento_item_precificacao.empresa_id = excluded.empresa_id;

  if not found then
    raise exception 'Não foi possível invalidar a validação técnica do item';
  end if;

  return new;
end;
$$;

comment on function private.orcamento_override_marcar_pendente_v1() is
  'Invalida automaticamente a validação técnica da tipologia após qualquer override manual; não calcula nem altera custo, fórmula ou corte.';

drop trigger if exists trg_orcamento_override_marcar_pendente_v1
  on public.orcamento_item_componentes_overrides;
create trigger trg_orcamento_override_marcar_pendente_v1
after insert on public.orcamento_item_componentes_overrides
for each row execute function private.orcamento_override_marcar_pendente_v1();

-- Override é histórico técnico: usuário autenticado pode ler e acrescentar eventos,
-- mas não reescrever nem apagar o que aconteceu.
drop policy if exists tenant_orcamento_item_componentes_overrides_update
  on public.orcamento_item_componentes_overrides;
drop policy if exists tenant_orcamento_item_componentes_overrides_delete
  on public.orcamento_item_componentes_overrides;

revoke update, delete on public.orcamento_item_componentes_overrides from authenticated;
grant select, insert on public.orcamento_item_componentes_overrides to authenticated;

revoke all on function private.orcamento_override_marcar_pendente_v1()
  from public, anon, authenticated;
