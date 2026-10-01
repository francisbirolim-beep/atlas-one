# CLAUDE.md — Atlas One

## Visao geral
Atlas One e um ERP interno para empresa de esquadrias (portas/janelas): orcamento, kanban de vendas, medicao final em obra, cadastro de clientes/produtos/fornecedores, CRM e um modulo de IA/agente.

## Arquitetura essencial
Next.js 14 (App Router) + TypeScript + Tailwind, backend em Supabase (Postgres + Storage), acessado direto do client via lib/*.ts (sem camada de API propria na maioria dos casos). Desenvolvimento e validacao sao locais; a integracao Git da Vercel fica desconectada e deployments sao manuais e deliberados. Detalhes em docs/ai-handoff/ARCHITECTURE.md.

## Regras para agentes de IA
- O Atlas One pode ser desenvolvido por diferentes agentes de IA. O repositorio e a UNICA fonte da verdade. Nenhum agente deve assumir que uma funcionalidade esta implementada apenas porque aparece em documentacao — antes de alterar codigo, verifique o estado real do repositorio.
- ANTES de implementar qualquer coisa, leia docs/ai-handoff/CURRENT_STATE.md e docs/ai-handoff/NEXT_TASK.md.
- Nunca commitar direto na branch main. Sempre: branch nova -> validar localmente com `npm run release:check` -> PR -> merge manual. Nao usar Preview Vercel como teste cotidiano; Preview so deve ser disparado manualmente quando houver um pacote candidato real.
- Ao finalizar uma implementacao relevante, atualize docs/ai-handoff/CURRENT_STATE.md, docs/ai-handoff/IMPLEMENTATIONS.md e docs/ai-handoff/NEXT_TASK.md.
- Decisoes tecnicas ja tomadas (que nao devem ser revertidas sem necessidade) estao em docs/ai-handoff/DECISIONS.md.

## Comandos essenciais
`npm run dev:lan` para desenvolvimento local, `npm run typecheck`, `npm run validate`, `npm run release:check`, `npm run vercel:preview` e `npm run vercel:prod`. Os dois comandos Vercel sao manuais e protegidos por preflight. Detalhes em docs/ai-handoff/COMMANDS.md.

## Documentacao
Toda a documentacao de handoff entre agentes fica em docs/ai-handoff/:
- CURRENT_STATE.md — o que esta REALMENTE funcionando, parcial, ou nao implementado.
- NEXT_TASK.md — onde o desenvolvimento parou e proximo passo recomendado.
- ARCHITECTURE.md — estrutura do projeto.
- DECISIONS.md — decisoes tecnicas a preservar.
- IMPLEMENTATIONS.md — historico cronologico resumido.
- COMMANDS.md — comandos de desenvolvimento.
