from pathlib import Path

current = Path('docs/ai-handoff/CURRENT_STATE.md')
impl = Path('docs/ai-handoff/IMPLEMENTATIONS.md')
next_task = Path('docs/ai-handoff/NEXT_TASK.md')

current_marker = '## PRODUTOS — PERFIS W.VETRO MERGEADOS; APPLY PENDENTE — 2026-08-17'
current_block = '''\n\n## PRODUTOS — PERFIS W.VETRO MERGEADOS; APPLY PENDENTE — 2026-08-17\n\nEstado mais recente, que substitui os gates antigos desta seção:\n- PR consolidada **#163** foi mergeada em `main`;\n- merge commit: `0b4b4a145f89bd3ad52626cd23335fb7bef2043e`;\n- a antiga PR #162 foi fechada como substituída, sem mergear seu preview Vercel vermelho;\n- o conjunto consolidado da #163 passou Build Validation, Vercel Preview e Supabase Database Control dry-run antes do merge;\n- dry-run oficial: run #85 / ID `32049150791`;\n- única migration pendente detectada: `20260817170000_reconciliar_proveniencia_perfis_wvetro_v1.sql`;\n- log oficial confirmou `DRY RUN: migrations will *not* be pushed to the database.`;\n- etapas de confirmação e apply ficaram `skipped`;\n- nenhum run de `Supabase Database Control` posterior ao #85 apareceu após o merge, portanto a migration **continua NÃO aplicada em produção**.\n\nO preview Vercel da #163 foi `success`. O deploy de produção do merge commit foi recusado por `build-rate-limit`; esta PR não altera código executável do app, apenas documentação, export read-only e arquivo de migration. Não confundir falha de quota de deploy com falha de build da implementação.\n\nPróximo gate de banco: obter autorização explícita específica do usuário para aplicar `20260817170000_reconciliar_proveniencia_perfis_wvetro_v1.sql` e só então executar `Supabase Database Control` em `main` com `mode=apply` e confirmação `APPLY_PRODUCTION`.\n'''

impl_marker = '## Perfis W.Vetro — PR #163 mergeada; dry-run oficial aprovado — 2026-08-17'
impl_block = '''\n\n## Perfis W.Vetro — PR #163 mergeada; dry-run oficial aprovado — 2026-08-17\n\n- PR #163 consolidou auditoria + migration de proveniência e foi mergeada em `main`;\n- merge commit `0b4b4a145f89bd3ad52626cd23335fb7bef2043e`;\n- Build Validation oficial: success;\n- Vercel Preview do head validado: success;\n- Supabase Database Control run #85 / `32049150791`: dry-run success;\n- somente `20260817170000_reconciliar_proveniencia_perfis_wvetro_v1.sql` apareceu como pendente;\n- nenhuma migration foi aplicada pelo PR/merge;\n- #162 encerrada como substituída para não ignorar o Vercel vermelho por rate limit;\n- apply em produção segue bloqueado até autorização explícita específica.\n'''

next_marker = '## GATE ATUAL — APLICAR PROVENIÊNCIA DOS PERFIS W.VETRO — 2026-08-17'
next_block = '''## GATE ATUAL — APLICAR PROVENIÊNCIA DOS PERFIS W.VETRO — 2026-08-17\n\nA PR #163 já foi mergeada em `main` no commit `0b4b4a145f89bd3ad52626cd23335fb7bef2043e`. O dry-run oficial do Supabase passou no run #85 (`32049150791`) e detectou somente:\n\n`20260817170000_reconciliar_proveniencia_perfis_wvetro_v1.sql`\n\nA migration **NÃO está aplicada em produção**. Não existe run de apply posterior ao dry-run #85.\n\nPróximo passo é um gate humano explícito:\n1. pedir autorização específica para aplicar esta migration em produção;\n2. somente após autorização, executar `Supabase Database Control` na branch `main`;\n3. `mode = apply`;\n4. `confirmation = APPLY_PRODUCTION`;\n5. acompanhar job/log até `Finished supabase db push.`;\n6. verificar pós-estado dos 1.307 perfis antes de documentar como ativo.\n\nNão interpretar mensagens genéricas como `pode continuar` como autorização deste apply.\n\nApós o apply confirmado, atualizar handoff e então seguir para a próxima frente de Produtos/Engenharia.\n\n'''

text = current.read_text(encoding='utf-8')
if current_marker not in text:
    current.write_text(text.rstrip() + current_block, encoding='utf-8')

text = impl.read_text(encoding='utf-8')
if impl_marker not in text:
    impl.write_text(text.rstrip() + impl_block, encoding='utf-8')

text = next_task.read_text(encoding='utf-8')
if next_marker not in text:
    title, rest = text.split('\n', 1)
    next_task.write_text(title + '\n\n' + next_block + rest.lstrip(), encoding='utf-8')
