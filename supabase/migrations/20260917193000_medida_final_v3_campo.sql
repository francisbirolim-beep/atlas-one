-- Atlas One — Medida Final V3 campo
-- Evolucao aditiva: preserva medidas orcadas e toda a estrutura V2 existente.

alter table public.medicao_itens
  add column if not exists referencia_vista text,
  add column if not exists contramarco text,
  add column if not exists cadeirinha text,
  add column if not exists observacoes_medicao text,
  add column if not exists status_medicao text not null default 'rascunho',
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.medicao_itens
    add constraint medicao_itens_referencia_vista_check
    check (referencia_vista is null or referencia_vista in ('interna','externa'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.medicao_itens
    add constraint medicao_itens_status_medicao_check
    check (status_medicao in ('rascunho','concluida','aguardando_conferencia','remedicao_solicitada','aprovada'));
exception when duplicate_object then null; end $$;

create index if not exists idx_medicao_itens_status_medicao
  on public.medicao_itens(medicao_id, status_medicao);

comment on column public.medicao_itens.referencia_vista is
  'Referencia obrigatoria da Medida Final: interna ou externa. Define direita/esquerda.';
comment on column public.medicao_itens.status_medicao is
  'Estado operacional da medicao individual da peca; nao substitui status da obra.';
