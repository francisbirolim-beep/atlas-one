# Permissões do Atlas One — setores, módulos e Master (24/10/2026)

## Regra operacional solicitada
- Cada setor para funcionário: **oculto** ou **liberado**. Quando oculto, nenhum módulo ou ação aparece.
- Cada módulo liberado: **sem acesso**, **somente consultar** ou **consultar e editar**.
- Ações individuais, especialmente recebimentos, pagamentos, aprovações, cancelamentos e liberações técnicas, têm seleção explícita. A liberação em lote não eleva ações críticas sem confirmação individual.
- Configurações gerais, usuários/acessos, integrações, automações administrativas e edição estrutural das etapas da Produção são exclusivas do Master.
- Configurações legadas com setor somente consulta permanecem limitadas: botão de transição aumenta o teto do setor, mantendo os módulos como consulta até uma nova escolha manual.
- Master conserva acesso completo.
- Não se altera automaticamente cargo, permissões persistidas, dados financeiros, obras ou automações.

## Alterações feitas na branch isolada
- Permissão reservada ao Master validada pelo avaliador de ações no navegador e no servidor; links para setores administrativos bloqueados para funcionários.
- Painel de usuários e editor de permissões da tela usam setor oculto/liberado, três níveis de módulo e indicação das ações críticas.
- Liberações em lote não concedem novas ações críticas e nunca delegam ações exclusivas do Master.
- A seleção manual de uma ação sensível continua possível ao Master nos módulos operacionais permitidos, respeitando o teto do setor e do módulo.
- O mesmo mecanismo é aplicado pelo catálogo compartilhado aos setores cadastrados, inclusive os dinâmicos.

## Testes e evidências
- **TypeScript:** `npm run typecheck` aprovado.
- **Build Next.js:** `npm run build` aprovado com URLs/chaves fictícias (sem acesso ao banco).
- **Testes:** `scripts/test-permissoes-master-setores-20261024.cjs`, hierarquia, Produção, permissões contextuais e delegações CMV aprovados.
- **Supabase:** consulta de leitura a `pg_policies` confirmou INSERT/UPDATE/DELETE da tabela `public.permissoes` condicionados a `private.is_master_atlas()` e ao `empresa_id`. `usuario_acessos_etapas` só possuía política SELECT para `authenticated`; gravação é feita via API/RPC com autenticação de Master.
- Não foram feitos DDL/DML, alterações de usuários, execuções de migração ou deploy em produção.

## Condição para publicar em produção
- Testar autenticação e acesso com sessão **real de funcionário sem Master** em **homologação**, inclusive tentativas HTTP/API e gravação direta por PostgREST negadas e ações operacionais autorizadas.
- Conferir na interface a migração de setores com acesso legado de consulta, edição crítica e revogação de permissões em sessão aberta.
- Validar a prévia da Vercel e CI no commit exato antes do merge.
- Preservar backup/rollback da implantação, sem indisponibilidade do serviço ativo.

**Nota de compatibilidade:** concessões herdadas antigas foram intencionalmente preservadas para evitar interrupção. Esta alteração impede concedê-las inadvertidamente em operações futuras em lote; a revisão e remoção dos legados exigem homologação dos usuários existentes.
