-- Atlas One — edição manual de materiais por tipologia.
-- Toda alteração manual invalida a validação técnica do item.
-- Overrides são append-only e ajustes diretos do pacote ganham histórico próprio.

create or replace function private.orcamento_item_marcar_pendente_v1(
  p_orcamento_id uuid,
  p_item_ref text,
  p_empresa_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_orcamento_id is null or nullif(btrim(coalesce(p_item_ref, '')), '') is null then
    return;
  end if;

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
    p_empresa_id,
    p_orcamento_id,
    p_item_ref,
    'pendente_validacao',
    p_motivo,
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
end;
$$;

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

  perform private.orcamento_item_marcar_pendente_v1(
    new.orcamento_id,
    new.item_ref,
    v_empresa,
    v_motivo
  );

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

create table if not exists public.pacote_tecnico_materiais_historico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default private.current_empresa_id(),
  pacote_id uuid references public.pacotes_tecnicos(id) on delete set null,
  material_id uuid references public.pacote_tecnico_materiais(id) on delete set null,
  orcamento_id uuid references public.orcamentos(id) on delete set null,
  item_ref text,
  evento text not null check (evento in ('inclusao_manual','alteracao_manual','exclusao_manual')),
  dados_antes jsonb,
  dados_depois jsonb,
  motivo text not null check (btrim(motivo) <> ''),
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz not null default now()
);

create index if not exists pacote_tecnico_materiais_hist_idx
  on public.pacote_tecnico_materiais_historico(empresa_id, orcamento_id, item_ref, created_at desc);

alter table public.pacote_tecnico_materiais_historico enable row level security;

drop policy if exists tenant_pacote_tecnico_materiais_historico_select
  on public.pacote_tecnico_materiais_historico;
create policy tenant_pacote_tecnico_materiais_historico_select
on public.pacote_tecnico_materiais_historico
for select to authenticated
using (empresa_id = (select private.current_empresa_id()));

grant select on public.pacote_tecnico_materiais_historico to authenticated;
revoke insert, update, delete on public.pacote_tecnico_materiais_historico from authenticated;

create or replace function private.pacote_material_manual_auditar_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manual boolean := false;
  v_evento text;
  v_empresa uuid;
  v_orcamento uuid;
  v_usuario_nome text;
  v_motivo text;
begin
  if tg_op = 'INSERT' then
    v_manual := coalesce(new.incluido_manual, false) or new.status_calculo = 'manual';
    v_evento := 'inclusao_manual';
  elsif tg_op = 'UPDATE' then
    v_manual := (
      new.status_calculo = 'manual'
      and (
        new.quantidade_ajustada is distinct from old.quantidade_ajustada
        or new.comprimento_corte_mm is distinct from old.comprimento_corte_mm
        or new.comprimento_barra_mm is distinct from old.comprimento_barra_mm
        or new.codigo is distinct from old.codigo
        or new.descricao is distinct from old.descricao
        or new.produto_id is distinct from old.produto_id
        or new.excluido is distinct from old.excluido
        or new.justificativa_ajuste is distinct from old.justificativa_ajuste
      )
    );
    v_evento := case when new.excluido = true and old.excluido is distinct from true
      then 'exclusao_manual' else 'alteracao_manual' end;
  end if;

  if not v_manual then
    return new;
  end if;

  select p.empresa_id, p.orcamento_id
    into v_empresa, v_orcamento
    from public.pacotes_tecnicos p
   where p.id = new.pacote_id;

  if v_empresa is null then
    raise exception 'Pacote técnico do material não encontrado ou sem empresa';
  end if;

  if new.empresa_id is distinct from v_empresa then
    raise exception 'Material técnico pertence a empresa diferente do pacote';
  end if;

  select u.nome
    into v_usuario_nome
    from public.usuarios u
   where u.id = auth.uid()
     and u.empresa_id = v_empresa;

  v_motivo := nullif(btrim(coalesce(new.justificativa_ajuste, '')), '');
  if v_motivo is null then
    raise exception 'Alteração manual de material exige justificativa';
  end if;

  insert into public.pacote_tecnico_materiais_historico(
    empresa_id,
    pacote_id,
    material_id,
    orcamento_id,
    item_ref,
    evento,
    dados_antes,
    dados_depois,
    motivo,
    usuario_id,
    usuario_nome
  ) values (
    v_empresa,
    new.pacote_id,
    new.id,
    v_orcamento,
    new.item_ref,
    v_evento,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),
    v_motivo,
    auth.uid(),
    v_usuario_nome
  );

  if v_orcamento is not null and nullif(btrim(coalesce(new.item_ref, '')), '') is not null then
    perform private.orcamento_item_marcar_pendente_v1(
      v_orcamento,
      new.item_ref,
      v_empresa,
      format('Alteração manual de material (%s) aguardando validação técnica.', v_evento)
    );
  end if;

  return new;
end;
$$;

comment on table public.pacote_tecnico_materiais_historico is
  'Histórico append-only dos ajustes manuais feitos diretamente no pacote técnico, com snapshot antes/depois e motivo.';

drop trigger if exists trg_pacote_material_manual_auditar_v1
  on public.pacote_tecnico_materiais;
create trigger trg_pacote_material_manual_auditar_v1
after insert or update of quantidade_ajustada, comprimento_corte_mm, comprimento_barra_mm,
  codigo, descricao, produto_id, status_calculo, incluido_manual, excluido, justificativa_ajuste
on public.pacote_tecnico_materiais
for each row execute function private.pacote_material_manual_auditar_v1();

-- Remoção física apagaria o histórico operacional. O fluxo existente usa `excluido=true`.
revoke delete on public.pacote_tecnico_materiais from authenticated;

revoke all on function private.orcamento_item_marcar_pendente_v1(uuid,text,uuid,text)
  from public, anon, authenticated;
revoke all on function private.orcamento_override_marcar_pendente_v1()
  from public, anon, authenticated;
revoke all on function private.pacote_material_manual_auditar_v1()
  from public, anon, authenticated;
