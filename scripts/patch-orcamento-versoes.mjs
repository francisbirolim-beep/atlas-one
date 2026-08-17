import fs from 'node:fs'

const path = 'components/system/KanbanPageFixed.tsx'
let src = fs.readFileSync(path, 'utf8')

function replaceOnce(from, to, label) {
  if (!src.includes(from)) throw new Error(`Trecho não encontrado: ${label}`)
  src = src.replace(from, to)
}

replaceOnce(
`function formatarMoedaBRL(valor: number | null | undefined): string {
const numero = Number(valor || 0)
return \`R$ \${numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`
}
`,
`function formatarMoedaBRL(valor: number | null | undefined): string {
const numero = Number(valor || 0)
return \`R$ \${numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`
}

function ehPdfOrcamentoAtlas(anexo: Anexo): boolean {
return anexo.titulo === 'Orçamento (PDF)' || /^Orçamento — Versão \\d+/i.test(anexo.titulo || '')
}

function normalizarVersoesLegadas(anexos: Anexo[] | null | undefined): Anexo[] {
let versao = 0
return (anexos || []).map(anexo => {
if (!ehPdfOrcamentoAtlas(anexo)) return anexo
versao += 1
if (anexo.titulo !== 'Orçamento (PDF)') return anexo
return { ...anexo, titulo: \`Orçamento — Versão \${String(versao).padStart(2, '0')} — data anterior não registrada\` }
})
}
`,
'helpers de versão'
)

replaceOnce(
`setCardSelecionado(card)
setEditando({ ...card, itens: itensComFoto })`,
`setCardSelecionado(card)
setEditando({ ...card, itens: itensComFoto, anexos: normalizarVersoesLegadas(card.anexos) })`,
'normalização ao abrir card'
)

replaceOnce(
`function enviarAnexoVendedor(anexo: Anexo) {
const numero = numeroWhatsApp(whatsappVendedor || vendedorInfo?.whatsapp || '')
if (!numero) {
alert('Informe ou cadastre o WhatsApp do vendedor antes de enviar o anexo.')
return
}
const nomeCliente = editando?.cliente_nome || cardSelecionado?.cliente_nome || 'cliente'
const mensagem = mensagemVendedor.trim() || \`Olá! Segue o anexo do orçamento de \${nomeCliente}.\`
const texto = \`\${mensagem}\\n\\n\${anexo.titulo}: \${anexo.url}\`
window.open(\`https://wa.me/\${numero}?text=\${encodeURIComponent(texto)}\`, '_blank')
}`,
`async function enviarAnexoVendedor(anexo: Anexo) {
const numero = numeroWhatsApp(whatsappVendedor || vendedorInfo?.whatsapp || '')
if (!numero) {
alert('Informe ou cadastre o WhatsApp do vendedor antes de enviar o anexo.')
return
}
const nomeCliente = editando?.cliente_nome || cardSelecionado?.cliente_nome || 'cliente'
const mensagem = mensagemVendedor.trim() || \`Olá! Segue o anexo do orçamento de \${nomeCliente}.\`
const texto = \`\${mensagem}\\n\\n\${anexo.titulo}: \${anexo.url}\`
window.open(\`https://wa.me/\${numero}?text=\${encodeURIComponent(texto)}\`, '_blank')
if (cardSelecionado) {
await registrarHistorico(cardSelecionado.id, usuario, 'Reenviou versão/anexo do orçamento', anexo.titulo)
listarHistorico(cardSelecionado.id).then(setHistorico)
}
}`,
'histórico de reenvio'
)

replaceOnce(
`let anexosFinais = editando.anexos || []
let pdfFile: File | null = null
const nomeArquivoPdf = \`orcamento-\${(editando.cliente_nome || 'cliente').trim().replace(/\\s+/g, '-').toLowerCase()}.pdf\``,
`let anexosFinais = normalizarVersoesLegadas(editando.anexos)
const versoesExistentes = anexosFinais.filter(ehPdfOrcamentoAtlas).length
const numeroVersao = versoesExistentes + 1
const versaoFormatada = String(numeroVersao).padStart(2, '0')
const dataEnvioFormatada = new Date(agoraIso).toLocaleString('pt-BR')
let pdfFile: File | null = null
let pdfUrlAtual: string | null = null
const slugCliente = (editando.cliente_nome || 'cliente').trim().replace(/\\s+/g, '-').toLowerCase()
const nomeArquivoPdf = \`orcamento-v\${versaoFormatada}-\${slugCliente}-\${agoraIso.slice(0, 10)}.pdf\``,
'numeração da versão'
)

replaceOnce(
`if (pdfUrl) {
anexosFinais = [...anexosFinais, { titulo: 'Orçamento (PDF)', nome: nomeArquivoPdf, url: pdfUrl }]
}`,
`if (pdfUrl) {
pdfUrlAtual = pdfUrl
anexosFinais = [...anexosFinais, {
titulo: \`Orçamento — Versão \${versaoFormatada} — enviado em \${dataEnvioFormatada}\`,
nome: nomeArquivoPdf,
url: pdfUrl,
}]
}`,
'metadados da nova versão'
)

replaceOnce(
`const linksAnexos = anexosFinais.map(a => \`\${a.titulo}: \${a.url}\`).join('\\n')
const textoCompleto = \`\${mensagemVendedor}\\n\\n\${linksAnexos}\``,
`const anexosParaEnvio = anexosFinais.filter(a => !ehPdfOrcamentoAtlas(a) || a.url === pdfUrlAtual)
const linksAnexos = anexosParaEnvio.map(a => \`\${a.titulo}: \${a.url}\`).join('\\n')
const textoCompleto = \`\${mensagemVendedor}\\n\\n\${linksAnexos}\``,
'não reenviar versões antigas no envio novo'
)

replaceOnce(
`<label className="block text-xs text-slate-500 mb-1">Anexos do orçamento</label>`,
`<label className="block text-xs text-slate-500 mb-1">Anexos e histórico de versões</label>`,
'rótulo do histórico de versões'
)

fs.writeFileSync(path, src)
console.log('Patch de versões aplicado com sucesso.')
