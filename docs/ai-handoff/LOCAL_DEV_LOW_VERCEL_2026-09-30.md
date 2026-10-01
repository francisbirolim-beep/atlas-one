# Atlas One — desenvolvimento local com baixo consumo de Vercel

Data: 2026-09-30

## Objetivo
Usar a Vercel como ambiente de publicação, não como ambiente de desenvolvimento/teste contínuo.

## Fluxo oficial
1. Desenvolver no workspace local `~/Atlas-One-Dev`.
2. Rodar o Atlas localmente com `npm run dev:lan`.
3. Testar no Mac em `http://localhost:3000`.
4. Na mesma rede local, testar pelo IP do Mac na porta 3000.
5. Fazer commits Git normalmente para manter histórico e rollback.
6. Antes de considerar um pacote pronto, rodar `npm run validate`.
7. `npm run validate` executa TypeScript e build completo do Next.js.
8. Push/PR no GitHub não deve gerar deployment automático da Vercel.
9. Quando o pacote estiver pronto para homologação, executar manualmente `npm run vercel:preview`.
10. Depois da aprovação, executar manualmente `npm run vercel:prod`.

## Segurança do ambiente local
- `.env.local` nunca entra no Git.
- O desenvolvimento local usa URL/chave pública do Supabase para autenticação e RLS.
- O ambiente local não recebe service-role de produção.
- Rotas administrativas que exigem service-role devem ser validadas por testes controlados/Preview final.
- W.Vetro e Neon de migração permanecem sem escrita automática local.

## Regra de publicação
Não publicar a cada correção.
Agrupar mudanças, validar localmente e gastar Vercel somente quando houver uma versão candidata real.

## Vercel
`vercel.json` usa `git.deploymentEnabled=false`, portanto commits e PRs deixam de ser gatilho automático de deployment. Preview e produção passam a ser ações manuais e deliberadas.
