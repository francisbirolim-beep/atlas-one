import fs from 'node:fs'

const currentPath = 'docs/ai-handoff/CURRENT_STATE.md'
const nextPath = 'docs/ai-handoff/NEXT_TASK.md'
const implPath = 'docs/ai-handoff/IMPLEMENTATIONS.md'

const marker = '## ORÇAMENTO — HISTÓRICO DE VERSÕES — PR #150'

function appendOnce(path, text) {
  let src = fs.readFileSync(path, 'utf8')
  if (src.includes(marker)) return
  if (!src.endsWith('\n')) src += '\n'
  src += `\n${text.trim()}\n`
  fs.writeFileSync(path, src)
}

appendOnce(currentPath, `
${marker}

PR #150 — **mergeada** em 2026-08-17.

Commit de merge:
\`2e983943fab550f7e32d0adeff0806a3dae2458c\`

Implementado na tela de Editar orçamento:
- PDFs do Atlas passam a receber numeração sequencial: Versão 01, 02, 03...;
- cada nova versão registra data e hora no próprio título exibido no histórico de anexos;
- versões anteriores permanecem preservadas;
- PDFs legados sem timestamp individual são identificados como \`data anterior não registrada\`, sem inventar data;
- o botão de reenviar versão/anexo continua disponível e o reenvio passa a ser registrado no histórico do orçamento;
- ao enviar uma nova versão pelo WhatsApp, PDFs Atlas de versões anteriores não são incluídos novamente na mensagem;
- a área de anexos em elaboração passou a se chamar \`Anexos e histórico de versões\`.

Sem migration e sem alteração de schema/banco.
`)

appendOnce(nextPath, `
${marker}

A PR #150 já foi mergeada no commit \`2e983943fab550f7e32d0adeff0806a3dae2458c\`.

Não refazer esta tarefa. O comportamento esperado é:
- nova versão de orçamento gera Versão 01/02/03... com data e hora;
- versões anteriores ficam preservadas;
- legado sem data individual não recebe timestamp inventado;
- reenvio individual fica registrado no histórico;
- envio de versão nova não manda novamente os PDFs Atlas antigos.

Essa melhoria não altera o próximo gate principal da base de produtos: a migration \`20260816210000_produtos_identidade_tecnica_v1.sql\` continua dependendo de autorização explícita para apply em produção.
`)

appendOnce(implPath, `
${marker}

Mergeada em 2026-08-17.

Commit de merge:
\`2e983943fab550f7e32d0adeff0806a3dae2458c\`

- versionamento sequencial dos PDFs gerados no Editar orçamento;
- data/hora registrada no título de cada nova versão;
- preservação das versões anteriores;
- legado sem timestamp individual marcado como data anterior não registrada;
- reenvio individual registrado no histórico;
- envio novo por WhatsApp exclui PDFs Atlas de versões anteriores;
- sem migration/schema change.
`)

console.log('Handoff PR #150 atualizado.')
