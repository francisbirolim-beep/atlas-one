# Verificação pós-apply — colaboração/notificações — 2026-08-18

Verificação independente, feita após autorização explícita do usuário.

## Workflow manual

- run: #90 / ID 32089991081
- status: completed
- conclusão: success
- criado em: 2026-08-18T01:56:01Z
- head SHA: c791d41687b117f706c0441064bbf357161d1dca

Trechos relevantes do log:
```text
Supabase migration control	Dry-run pending migrations	2026-08-18T01:56:15.6259108Z  • 20260818013000_colaboracao_notificacoes_v1.sql
Supabase migration control	Dry-run pending migrations	2026-08-18T01:56:15.6259883Z Finished supabase db push.
Supabase migration control	Require explicit production confirmation	﻿2026-08-18T01:56:16.0192198Z ##[group]Run set -euo pipefail
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0192487Z ^[[36;1mset -euo pipefail^[[0m
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0192731Z ^[[36;1mif [ "$CONFIRMATION" != "APPLY_PRODUCTION" ]; then^[[0m
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0193069Z ^[[36;1m  echo "Apply blocked: confirmation must be APPLY_PRODUCTION"^[[0m
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0193349Z ^[[36;1m  exit 1^[[0m
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0193515Z ^[[36;1mfi^[[0m
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0225156Z shell: /usr/bin/bash --noprofile --norc -e -o pipefail {0}
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0225444Z env:
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0225784Z   SUPABASE_ACCESS_TOKEN: ***
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0226013Z   SUPABASE_DB_PASSWORD: ***
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0226251Z   SUPABASE_PROJECT_ID: ***
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0226458Z   SUPABASE_INTERNAL_IMAGE_REGISTRY: ghcr.io
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0227118Z   SUPABASE_DB_URL: ***aws-0-sa-east-1.pooler.supabase.com:5432/postgres
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0227443Z   CONFIRMATION: APPLY_PRODUCTION
Supabase migration control	Require explicit production confirmation	2026-08-18T01:56:16.0227661Z ##[endgroup]
Supabase migration control	Apply pending migrations	﻿2026-08-18T01:56:16.2132684Z ##[group]Run supabase db push --db-url "$SUPABASE_DB_URL"
Supabase migration control	Apply pending migrations	2026-08-18T01:56:16.2133061Z ^[[36;1msupabase db push --db-url "$SUPABASE_DB_URL"^[[0m
Supabase migration control	Apply pending migrations	2026-08-18T01:56:16.2164447Z shell: /usr/bin/bash --noprofile --norc -e -o pipefail {0}
Supabase migration control	Apply pending migrations	2026-08-18T01:56:16.2164720Z env:
Supabase migration control	Apply pending migrations	2026-08-18T01:56:16.2165114Z   SUPABASE_ACCESS_TOKEN: ***
Supabase migration control	Apply pending migrations	2026-08-18T01:56:16.2165337Z   SUPABASE_DB_PASSWORD: ***
Supabase migration control	Apply pending migrations	2026-08-18T01:56:16.2165555Z   SUPABASE_PROJECT_ID: ***
Supabase migration control	Apply pending migrations	2026-08-18T01:56:16.2165771Z   SUPABASE_INTERNAL_IMAGE_REGISTRY: ghcr.io
Supabase migration control	Apply pending migrations	2026-08-18T01:56:16.2166356Z   SUPABASE_DB_URL: ***aws-0-sa-east-1.pooler.supabase.com:5432/postgres
Supabase migration control	Apply pending migrations	2026-08-18T01:56:16.2166658Z ##[endgroup]
Supabase migration control	Apply pending migrations	2026-08-18T01:56:16.7595496Z Connecting to remote database...
Supabase migration control	Apply pending migrations	2026-08-18T01:56:18.0389933Z Do you want to push these migrations to the remote database?
Supabase migration control	Apply pending migrations	2026-08-18T01:56:18.0390899Z  • 20260818013000_colaboracao_notificacoes_v1.sql
Supabase migration control	Apply pending migrations	2026-08-18T01:56:18.0421951Z  [Y/n] 
Supabase migration control	Apply pending migrations	2026-08-18T01:56:19.0326415Z Applying migration 20260818013000_colaboracao_notificacoes_v1.sql...
Supabase migration control	Apply pending migrations	2026-08-18T01:56:26.8264707Z Finished supabase db push.
```

## Banco de produção — transação READ ONLY

```text
BEGIN
transaction_read_only=on
migration=20260818013000
tarefas_novas_colunas=4
notificacoes_table=1
preferencias_table=1
policy_temporaria_tarefas=0
policies_tarefas=4
policies_colunas=4
policies_notificacoes=3
triggers_notificacao=2
realtime_notificacoes=1
COMMIT
```

Critérios mínimos validados: migration registrada, 4 novas colunas em tarefas, tabelas de notificações/preferências presentes, policy temporária permissiva removida e notificações presentes no Realtime.
