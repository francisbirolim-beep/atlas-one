begin;

alter table public.orcamentos
  add column if not exists revisao_grupo_id uuid,
  add column if not exists revisao_versao integer not null default 1,
  add column if not exists revisao_atual boolean not null default true,
  add column if not exists revisao_origem_id uuid references public.orcamentos(id) on delete set null,
  add column if not exists revisao_tipo text,
  add column if not exists revisao_motivo text,
  add column if not exists revisao_criada_em timestamptz,
  add column if not exists revisao_criada_por_id uuid,
  add column if not exists revisao_criada_por_nome text;

update public.orcamentos set revisao_grupo_id = id where revisao_grupo_id is null;

alter table public.orcamentos alter column revisao_grupo_id set not null;

alter table public.orcamentos
  drop constraint if exists orcamentos_revisao_versao_check,
  add constraint orcamentos_revisao_versao_check check (revisao_versao > 0),
  drop constraint if exists orcamentos_revisao_tipo_check,
  add constraint orcamentos_revisao_tipo_check check (revisao_tipo is null or revisao_tipo in ('alteracao','complemento'));

create unique index if not exists orcamentos_revisao_grupo_versao_uidx on public.orcamentos(revisao_grupo_id, revisao_versao);
create unique index if not exists orcamentos_revisao_atual_uidx on public.orcamentos(revisao_grupo_id) where revisao_atual = true;
create index if not exists orcamentos_revisao_origem_idx on public.orcamentos(revisao_origem_id);

create or replace function public.criar_revisao_orcamento(
  p_orcamento_id uuid,
  p_tipo text,
  p_motivo text default null,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_origem public.orcamentos%rowtype;
  v_grupo uuid;
  v_versao integer;
  v_novo_id uuid := gen_random_uuid();
  v_coluna_inicial uuid;
  v_payload jsonb;
begin
  if p_tipo not in ('alteracao','complemento') then raise exception 'Tipo de revisão inválido.'; end if;

  select * into v_origem from public.orcamentos where id = p_orcamento_id for update;
  if not found then raise exception 'Orçamento não encontrado.'; end if;

  v_grupo := coalesce(v_origem.revisao_grupo_id, v_origem.id);
  perform 1 from public.orcamentos where revisao_grupo_id = v_grupo for update;
  select coalesce(max(revisao_versao), 0) + 1 into v_versao from public.orcamentos where revisao_grupo_id = v_grupo;
  select id into v_coluna_inicial from public.kanban_colunas order by ordem asc limit 1;

  update public.orcamentos set revisao_atual = false, updated_at = now() where revisao_grupo_id = v_grupo and revisao_atual = true;

  v_payload := to_jsonb(v_origem) || jsonb_build_object(
    'id', v_novo_id, 'created_at', now(), 'updated_at', now(), 'numero', v_origem.numero,
    'revisao_grupo_id', v_grupo, 'revisao_versao', v_versao, 'revisao_atual', true,
    'revisao_origem_id', v_origem.id, 'revisao_tipo', p_tipo,
    'revisao_motivo', nullif(trim(coalesce(p_motivo, '')), ''), 'revisao_criada_em', now(),
    'revisao_criada_por_id', p_usuario_id, 'revisao_criada_por_nome', nullif(trim(coalesce(p_usuario_nome, '')), ''),
    'coluna_id', v_coluna_inicial, 'coluna_atualizada_em', now(), 'kanban_entrada_em', now(),
    'status', 'rascunho', 'motivo_perda', null, 'orcamento_iniciado_em', null,
    'orcamento_finalizado_em', null, 'enviado_vendedor_em', null
  );

  insert into public.orcamentos select (jsonb_populate_record(null::public.orcamentos, v_payload)).*;

  insert into public.orcamento_item_precificacao (id,orcamento_id,item_ref,margem_herda_geral,margem_pct,sobra_herda_geral,cobrar_sobra,custo_produtivo,custo_sobra,custo_extras,custo_total,preco_venda,observacoes,created_at,updated_at)
  select gen_random_uuid(),v_novo_id,item_ref,margem_herda_geral,margem_pct,sobra_herda_geral,cobrar_sobra,custo_produtivo,custo_sobra,custo_extras,custo_total,preco_venda,observacoes,now(),now() from public.orcamento_item_precificacao where orcamento_id = v_origem.id;

  insert into public.orcamento_item_componentes_overrides (id,orcamento_id,item_ref,tipologia_id,formula_id,componente_tipo,acao,codigo_origem,produto_origem_id,codigo_destino,produto_destino_id,descricao_destino,quantidade_override,comprimento_override_mm,escopo,justificativa,criado_por_id,criado_por_nome,created_at,updated_at)
  select gen_random_uuid(),v_novo_id,item_ref,tipologia_id,formula_id,componente_tipo,acao,codigo_origem,produto_origem_id,codigo_destino,produto_destino_id,descricao_destino,quantidade_override,comprimento_override_mm,escopo,justificativa,criado_por_id,criado_por_nome,now(),now() from public.orcamento_item_componentes_overrides where orcamento_id = v_origem.id;

  insert into public.orcamento_precificacao_componentes (id,orcamento_id,pacote_id,material_id,item_ref,categoria,produto_id,catalogo_custo_id,codigo,descricao,unidade,quantidade,custo_unitario,custo_total,margem_pct,preco_venda,origem_custo,custo_pendente,incluido_manual,excluido,observacoes,created_at,updated_at)
  select gen_random_uuid(),v_novo_id,null,null,item_ref,categoria,produto_id,catalogo_custo_id,codigo,descricao,unidade,quantidade,custo_unitario,custo_total,margem_pct,preco_venda,origem_custo,custo_pendente,incluido_manual,excluido,observacoes,now(),now() from public.orcamento_precificacao_componentes where orcamento_id = v_origem.id;

  return v_novo_id;
end;
$$;

revoke all on function public.criar_revisao_orcamento(uuid,text,text,uuid,text) from public;
revoke all on function public.criar_revisao_orcamento(uuid,text,text,uuid,text) from anon;
grant execute on function public.criar_revisao_orcamento(uuid,text,text,uuid,text) to authenticated;

commit;
