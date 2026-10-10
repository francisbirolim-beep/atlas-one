-- Garante em reconstruções novas o campo livre de fórmulas/observações de corte por preset.
-- O banco de produção já possuía este campo; a operação é idempotente.
alter table public.engenharia_variaveis_preset
  add column if not exists campos_corte jsonb not null default '{}'::jsonb;

comment on column public.engenharia_variaveis_preset.campos_corte is
  'Mapa livre codigo_perfil -> texto (formula/observacao de corte), preenchido manualmente pelo usuario a partir de testes reais no Wvetro. Texto livre, sem validacao de formula.';
