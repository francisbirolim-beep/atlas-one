-- Atlas One — contrato mínimo para Composição e Precificação por tipologia.
-- Esta migration é deliberadamente aditiva: não cria fórmula, material, custo, corte ou preço.
-- W.Vetro permanece somente como referência até validação explícita no Atlas.

alter table public.orcamentos
  add column if not exists sobra_politica_global text not null default 'respeitar_item';

alter table public.orcamentos
  drop constraint if exists orcamentos_sobra_politica_global_check;
alter table public.orcamentos
  add constraint orcamentos_sobra_politica_global_check
  check (sobra_politica_global in ('respeitar_item','cobrar_todas','nao_cobrar_nenhuma'));

comment on column public.orcamentos.sobra_politica_global is
  'Política global de sobra do orçamento: respeita regra individual, cobra todas ou não cobra nenhuma. Não altera o histórico físico da sobra.';

alter table public.orcamento_item_precificacao
  add column if not exists situacao_tecnica text not null default 'pendente_validacao',
  add column if not exists situacao_tecnica_motivo text,
  add column if not exists validado_tecnicamente_em timestamptz,
  add column if not exists validado_tecnicamente_por_id uuid,
  add column if not exists validado_tecnicamente_por_nome text;

alter table public.orcamento_item_precificacao
  drop constraint if exists orcamento_item_precificacao_situacao_tecnica_check;
alter table public.orcamento_item_precificacao
  add constraint orcamento_item_precificacao_situacao_tecnica_check
  check (situacao_tecnica in ('pendente_formula','pendente_custo','pendente_validacao','validada'));

comment on column public.orcamento_item_precificacao.situacao_tecnica is
  'Estado técnico persistido da tipologia. Somente validada pode participar de preço final/liberação quando os demais gates também estiverem satisfeitos.';
comment on column public.orcamento_item_precificacao.situacao_tecnica_motivo is
  'Motivo legível da pendência/validação técnica; nunca deve ser preenchido por inferência de regra inexistente.';

alter table public.orcamento_precificacao_componentes
  add column if not exists origem_custo_oficial text,
  add column if not exists referencia_custo_origem text,
  add column if not exists referencia_custo_valor numeric,
  add column if not exists referencia_custo_dados jsonb not null default '{}'::jsonb;

-- Classificação determinística da origem que já existia no Atlas.
-- Nenhum valor é recalculado e nenhuma referência externa passa a ser custo oficial.
update public.orcamento_precificacao_componentes
set origem_custo_oficial = case
  when origem_custo in ('produto','catalogo','calculado') then 'atlas'
  when origem_custo = 'manual' then 'manual'
  else 'pendente'
end
where origem_custo_oficial is null;

alter table public.orcamento_precificacao_componentes
  alter column origem_custo_oficial set default 'pendente',
  alter column origem_custo_oficial set not null;

alter table public.orcamento_precificacao_componentes
  drop constraint if exists orcamento_precificacao_componentes_origem_oficial_check;
alter table public.orcamento_precificacao_componentes
  add constraint orcamento_precificacao_componentes_origem_oficial_check
  check (origem_custo_oficial in ('atlas','manual','pendente'));

alter table public.orcamento_precificacao_componentes
  drop constraint if exists orcamento_precificacao_componentes_ref_origem_check;
alter table public.orcamento_precificacao_componentes
  add constraint orcamento_precificacao_componentes_ref_origem_check
  check (referencia_custo_origem is null or referencia_custo_origem in ('wvetro'));

alter table public.orcamento_precificacao_componentes
  drop constraint if exists orcamento_precificacao_componentes_ref_valor_check;
alter table public.orcamento_precificacao_componentes
  add constraint orcamento_precificacao_componentes_ref_valor_check
  check (referencia_custo_valor is null or referencia_custo_valor >= 0);

comment on column public.orcamento_precificacao_componentes.origem_custo_oficial is
  'Origem do custo efetivamente aceito pelo Atlas. W.Vetro nunca é promovido automaticamente a custo oficial.';
comment on column public.orcamento_precificacao_componentes.referencia_custo_origem is
  'Origem externa opcional usada apenas como referência; atualmente aceita W.Vetro.';
comment on column public.orcamento_precificacao_componentes.referencia_custo_valor is
  'Valor externo de referência. Não participa automaticamente do custo oficial nem do preço final.';
comment on column public.orcamento_precificacao_componentes.referencia_custo_dados is
  'Metadados rastreáveis da referência externa (documento/importação/chave), sem alterar o custo oficial.';

create index if not exists orc_item_precificacao_situacao_idx
  on public.orcamento_item_precificacao(orcamento_id, situacao_tecnica);
create index if not exists orc_precificacao_componentes_origem_oficial_idx
  on public.orcamento_precificacao_componentes(orcamento_id, item_ref, origem_custo_oficial, custo_pendente);
