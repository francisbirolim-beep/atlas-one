import fs from 'node:fs'

const files = {
  current: 'docs/ai-handoff/CURRENT_STATE.md',
  next: 'docs/ai-handoff/NEXT_TASK.md',
  impl: 'docs/ai-handoff/IMPLEMENTATIONS.md',
}

const marker = '## ORÇAMENTO — EXCLUSÃO AUDITÁVEL DE ANEXOS E REENVIO — PR #156'

function appendOnce(path, block) {
  let src = fs.readFileSync(path, 'utf8')
  if (src.includes(marker)) return
  if (!src.endsWith('\n')) src += '\n'
  src += `\n${block.trim()}\n`
  fs.writeFileSync(path, src)
}

appendOnce(files.current, `
${marker}

PR #156 — **mergeada** em 2026-08-17.

Commit de merge:
\`9a6cbb024cdc6aca9e7fe2faee8d14acb1adac69\`

Estado ativo em \`Editar orçamento\`:
- anexos não são apagados fisicamente quando o usuário escolhe Excluir;
- a exclusão é lógica e exige motivo obrigatório;
- o JSON do anexo preserva \`excluido_em\`, \`excluido_por_id\`, \`excluido_por_nome\` e \`motivo_exclusao\`;
- a exclusão também é registrada em \`historico_orcamento\` via helper existente;
- anexo excluído permanece visível em vermelho/riscado e o arquivo continua podendo ser aberto para auditoria;
- anexo excluído não pode ser reenviado e é removido de futuros conjuntos de envio;
- versões excluídas continuam contando no histórico, portanto números de versão não são reutilizados;
- orçamento finalizado passa a exibir o campo WhatsApp do vendedor e a mensagem antes do reenvio, preenchendo o número cadastrado quando disponível e permitindo alteração manual;
- a mesma exclusão lógica/auditável vale durante a elaboração.

Sem migration e sem alteração de schema: os metadados adicionais usam o JSON existente em \`orcamentos.anexos\`.
`)

appendOnce(files.next, `
${marker}

A PR #156 já foi mergeada no commit \`9a6cbb024cdc6aca9e7fe2faee8d14acb1adac69\`.

Não voltar a excluir anexos de orçamento com \`filter/splice\` ou removendo o arquivo do Storage. O comportamento esperado é soft delete com motivo obrigatório e trilha de auditoria, preservando acesso de consulta ao arquivo.

Anexos com \`excluido_em\` não devem ser reenviados nem incluídos em novos envios. O campo de WhatsApp do vendedor deve permanecer disponível também no orçamento finalizado para reenvio.

Essa melhoria é independente do gate da migration de identidade técnica de produtos, que continua exigindo apply explícito em produção.
`)

appendOnce(files.impl, `
${marker}

Mergeada em 2026-08-17 no commit \`9a6cbb024cdc6aca9e7fe2faee8d14acb1adac69\`.

- exclusão de anexo virou soft delete auditável;
- motivo é obrigatório e ficam registrados data, usuário e motivo;
- arquivo excluído permanece abrível e visualmente marcado em vermelho/riscado;
- reenvio e novos envios ignoram anexos excluídos;
- orçamento finalizado ganhou WhatsApp do vendedor e mensagem no fluxo de reenvio;
- sem migration/schema change.
`)

console.log('Handoff PR #156 atualizado.')
