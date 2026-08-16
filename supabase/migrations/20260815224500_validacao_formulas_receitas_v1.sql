-- Engenharia / Plano de Corte — validação auditável de fórmulas
--
-- Fórmulas só podem gerar medidas automáticas quando explicitamente validadas.
-- O snapshot do Plano de Corte leva junto o estado de validação existente no
-- momento da geração para manter rastreabilidade.

alter table public.engenharia_receita_componentes
  add column if not exists formula_quantidade_validada boolean not null default false,
  add column if not exists formula_corte_validada boolean not null default false,
  add column if not exists formula_validada_em timestamptz,
  add column if not exists formula_validada_por_id uuid,
  add column if not exists formula_validada_por_nome text,
  add column if not exists evidencia_validacao text;

alter table public.plano_corte_componentes
  add column if not exists formula_quantidade_validada boolean not null default false,
  add column if not exists formula_corte_validada boolean not null default false;

comment on column public.engenharia_receita_componentes.formula_corte_validada is
  'Somente TRUE autoriza o motor restrito do Atlas a calcular corte_mm automaticamente.';

comment on column public.engenharia_receita_componentes.evidencia_validacao is
  'Referência técnica usada para validar a fórmula: relatório, teste, amostra ou observação.';
