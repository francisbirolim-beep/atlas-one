-- Atlas One v10: Atlas AI Core - suporte a Ollama + auditoria ampliada
-- Nao altera nenhuma tabela existente de forma destrutiva, so adiciona colunas novas
-- (todas nullable ou com default), entao e seguro rodar em cima do v9.

alter table ia_uso_log add column if not exists empresa text;
alter table ia_uso_log add column if not exists agente_nome text;
alter table ia_uso_log add column if not exists setor_id text references setores(id);
alter table ia_uso_log add column if not exists duracao_ms integer;
alter table ia_uso_log add column if not exists custo_estimado numeric;
alter table ia_uso_log add column if not exists fallback_policy text default 'configured_provider_only';

create index if not exists idx_ia_uso_log_setor_id on ia_uso_log(setor_id);
