/** Identifica apenas URLs de PDFs explicitamente fornecidas pela API W.Vetro. */
function acharPdfWVetro(valor: unknown, profundidade = 0): string | null {
  if (profundidade > 8 || valor == null) return null
  if (typeof valor === 'string') {
    const s = valor.trim()
    if (/^https?:\/\//i.test(s) && /(?:\.pdf(?:$|[?#])|pdf)/i.test(s)) return s
    return null
  }
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const achado = acharPdfWVetro(item, profundidade + 1)
      if (achado) return achado
    }
    return null
  }
  if (typeof valor !== 'object') return null
  for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof item === 'string') {
      const s = item.trim()
      if (/^https?:\/\//i.test(s) && (/pdf/i.test(chave) || /\.pdf(?:$|[?#])/i.test(s))) return s
    }
    const achado = acharPdfWVetro(item, profundidade + 1)
    if (achado) return achado
  }
  return null
}

export function anexosComPdfWVetro(anexosAtuais: unknown, payload: unknown, numeroWvetro: string) {
  const atuais = Array.isArray(anexosAtuais) ? [...anexosAtuais] : []
  const pdfUrl = acharPdfWVetro(payload)
  if (!pdfUrl) return atuais
  const jaExiste = atuais.some((a: any) => String(a?.url || '').trim() === pdfUrl || /pdf original w\.?vetro/i.test(String(a?.titulo || '')))
  if (jaExiste) return atuais
  return [...atuais, {
    titulo: 'PDF original W.Vetro',
    nome: `orcamento-wvetro-${numeroWvetro}.pdf`,
    url: pdfUrl,
  }]
}

