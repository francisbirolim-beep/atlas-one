alter table public.orcamentos
  add column if not exists obra_nome text;

comment on column public.orcamentos.obra_nome is
  'Nome ou identificação livre da obra informado no pedido de orçamento; opcional e independente do vínculo obra_id.';
