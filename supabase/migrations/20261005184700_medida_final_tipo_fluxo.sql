-- Distingue a medição de contramarco da medida final usada para fabricar as tipologias.
-- Medições históricas continuam como 'tipologia', preservando o fluxo de produção existente.

alter table public.medicoes_finais
  add column if not exists tipo_medicao text not null default 'tipologia';

update public.medicoes_finais
set tipo_medicao = 'tipologia'
where tipo_medicao is null or tipo_medicao not in ('tipologia', 'contramarco');

alter table public.medicoes_finais
  drop constraint if exists medicoes_finais_tipo_medicao_check;

alter table public.medicoes_finais
  add constraint medicoes_finais_tipo_medicao_check
  check (tipo_medicao in ('tipologia', 'contramarco'));

create index if not exists idx_medicoes_finais_cliente_tipo
  on public.medicoes_finais(cliente_id, tipo_medicao, created_at desc);

create index if not exists idx_medicoes_finais_orcamento_tipo
  on public.medicoes_finais(orcamento_id, tipo_medicao, created_at desc)
  where orcamento_id is not null;
