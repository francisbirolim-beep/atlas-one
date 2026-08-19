-- Migration: engenharia_campos_corte_preset_v1
-- Data: 2026-08-19
--
-- Objetivo: permitir registrar, por configuracao validada de orcamento
-- (engenharia_variaveis_preset), um mapa livre "perfil -> formula/observacao"
-- para o corte de cada tipologia. Nao substitui nenhum calculo existente:
-- e apenas um campo de texto livre por perfil, preenchido manualmente pelo
-- usuario a partir de testes reais no Wvetro, ate que o padrao de cada
-- formula seja confirmado com evidencia (2+ testes por tipologia).
--
-- Regras de seguranca:
-- - aditiva e idempotente (add column if not exists);
-- - nenhuma formula e inferida ou inventada por esta migration;
-- - coluna nullable, default '{}', nao afeta linhas existentes;
-- - nenhum dado e escrito automaticamente aqui.

begin;

alter table public.engenharia_variaveis_preset
  add column if not exists campos_corte jsonb not null default '{}'::jsonb;

comment on column public.engenharia_variaveis_preset.campos_corte is
  'Mapa livre codigo_perfil -> texto (formula/observacao de corte), preenchido manualmente pelo usuario a partir de testes reais no Wvetro. Texto livre, sem validacao de formula.';

commit;
