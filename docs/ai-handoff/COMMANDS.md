# COMMANDS.md — Atlas One

Comandos oficiais do projeto. O fluxo e local-first para reduzir consumo da Vercel.

## Instalacao
`npm ci`

## Desenvolvimento local
`npm run dev` — desenvolvimento local padrao.
`npm run dev:lan` — abre em `0.0.0.0` para testar no Mac e em aparelhos da mesma rede.

Workspace operacional no Mac do Francis:
`~/Atlas-One-Dev`

## Validacao local
`npm run typecheck` — executa `tsc --noEmit`.
`npm run validate` — executa typecheck + build completo Next.js.
`npm run release:check` — preflight de candidato a release sem criar deployment.

## Preview Vercel
`npm run vercel:preview`

Esse comando e manual. Antes do deployment ele executa o preflight local completo.

## Producao Vercel
`npm run vercel:prod`

Esse comando e manual e protegido. So publica se:
- a branch local for `main`;
- nao houver alteracoes locais nao commitadas;
- a `main` local estiver exatamente igual a `origin/main`;
- TypeScript e build completo passarem.

## Regra de consumo Vercel
A integracao GitHub -> Vercel fica desconectada de proposito.
Push, branch e PR no GitHub nao devem criar deployments.
Usar Vercel apenas para um Preview candidato ou para a publicacao final.

Projeto de producao: `atlas-one-eight-rho.vercel.app`.

## Ambiente local
`.env.local` e ignorado pelo Git.
O ambiente local usa credenciais publicas adequadas para login/RLS e nao deve receber service-role de producao.
Rotas administrativas que exigem privilegios elevados devem ser validadas de forma controlada no Preview final ou pelas ferramentas de banco.

## Testes
Nao ha framework geral de testes automatizados configurado. Usar os scripts de regressao especificos existentes quando a area alterada possuir um.

## Banco de dados / migrations
Migrations versionadas ficam em `supabase/migrations/`.
Para DDL de producao, usar a ferramenta MCP do Supabase com `apply_migration` e manter o arquivo correspondente no repositorio.
