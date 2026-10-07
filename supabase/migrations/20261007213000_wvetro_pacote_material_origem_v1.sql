alter table public.pacote_tecnico_materiais
  add column if not exists custo_wvetro numeric null,
  add column if not exists venda_wvetro numeric null,
  add column if not exists wvetro_dados jsonb not null default '{}'::jsonb;

comment on column public.pacote_tecnico_materiais.custo_wvetro is
  'Valor bruto CustoVlr recebido na linha do W.Vetro. Não representa automaticamente custo unitário nem custo da barra.';
comment on column public.pacote_tecnico_materiais.venda_wvetro is
  'Valor bruto VendaVlr recebido na linha do W.Vetro.';
comment on column public.pacote_tecnico_materiais.wvetro_dados is
  'Snapshot bruto do componente W.Vetro usado para gerar esta linha técnica.';
