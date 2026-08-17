import fs from 'node:fs'

const files = {
  current: 'docs/ai-handoff/CURRENT_STATE.md',
  next: 'docs/ai-handoff/NEXT_TASK.md',
  impl: 'docs/ai-handoff/IMPLEMENTATIONS.md',
}

const marker = '## ORÇAMENTO FINALIZADO — ANEXO PERMANENTE — PR #152'

function appendOnce(path, block) {
  let src = fs.readFileSync(path, 'utf8')
  if (src.includes(marker)) return
  if (!src.endsWith('\n')) src += '\n'
  src += '\n' + block.trim() + '\n'
  fs.writeFileSync(path, src)
}

appendOnce(files.current, `
${marker}

PR #152 — **mergeada** em 2026-08-17.

Commit de merge:
\`a7679d9bd103a56e838d1e4376232c65d0e9f75a\`

Correção ativa em \`Editar orçamento\`:
- orçamento já finalizado continua exibindo o histórico de anexos e \`Reenviar\`;
- passa a exibir também, de forma permanente, \`Anexar novo orçamento / revisão\`;
- novo anexo em orçamento finalizado é persistido imediatamente em \`orcamentos.anexos\`;
- anexos anteriores são preservados;
- o card e o modal são atualizados na mesma sessão;
- a inclusão do novo arquivo é registrada no histórico do orçamento.

Sem migration e sem alteração de schema.
`)

appendOnce(files.next, `
${marker}

A PR #152 já foi mergeada no commit \`a7679d9bd103a56e838d1e4376232c65d0e9f75a\`.

Não refazer esta correção. Em orçamento finalizado, a área \`Anexar novo orçamento / revisão\` deve permanecer disponível e o upload deve ser persistido imediatamente, preservando todos os anexos anteriores.

A tarefa principal de produtos/migration continua separada desta correção de interface.
`)

appendOnce(files.impl, `
${marker}

Mergeada em 2026-08-17 no commit \`a7679d9bd103a56e838d1e4376232c65d0e9f75a\`.

- corrigido desaparecimento do botão/campo de anexo após finalização do orçamento;
- adicionada área permanente para nova revisão em orçamento finalizado;
- upload finalizado persiste imediatamente no JSON de anexos;
- histórico e anexos anteriores preservados;
- inclusão registrada no histórico;
- sem migration/schema change.
`)

console.log('Handoff PR #152 atualizado.')
