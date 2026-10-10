-- Fornecedor 360: produtos extraídos de catálogo entram inativos até validação humana.
-- A API de importação já usa status_validacao = 'pendente'; este ajuste alinha o schema ao fluxo.

alter table public.produtos
  drop constraint if exists produtos_status_validacao_check;

alter table public.produtos
  add constraint produtos_status_validacao_check
  check (status_validacao = any (array['pendente'::text, 'importado'::text, 'revisado'::text, 'validado'::text]));
