# COMMANDS.md — Atlas One

Comandos reais existentes no projeto (ver package.json — nao ha lint nem test configurados).

## Instalacao
npm install

## Desenvolvimento
npm run dev

## Build (usado tambem como verificacao de typecheck, ja que nao ha script separado)
npm run build

## Start (producao local, apos build)
npm run start

## Lint / typecheck
Nao ha script dedicado. next build ja roda o typecheck do TypeScript como parte do processo (falha se houver erro de tipo). Para checar tipos sem build completo, rodar diretamente: npx tsc --noEmit

## Testes
Nao ha framework de teste configurado no projeto (sem jest/vitest/playwright no package.json, sem pasta de testes). Nao inventar comandos de teste.

## Banco de dados / migrations
Nao ha CLI do Supabase configurada no repo (sem pasta supabase/ com config.toml). As migrations existentes como arquivo sao supabase-migration-v2 ate v15 na raiz do repo (aplicadas manualmente). Migrations mais recentes (v16+) foram aplicadas direto no banco via ferramenta MCP do Supabase, sem arquivo correspondente — ver DECISIONS.md. Para aplicar uma migration nova: usar a ferramenta MCP do Supabase (apply_migration) apontando para o project_id urtqbvjpwnrfaayolymt, e idealmente tambem salvar um arquivo supabase-migration-vNN-descricao.sql no repo para manter o historico.

## Deploy
Nao ha comando manual — Vercel builda automaticamente a cada push (preview em PR, producao em merge para main). Projeto Vercel: atlas-one-eight-rho.vercel.app (dominio de producao referenciado no repo).
