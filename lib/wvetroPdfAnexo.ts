/** Identifica apenas links que representam PDFs fornecidos pela API W.Vetro.
 * Não interpretar miniaturas, fotografias nem previews como PDF original.
 */
function acharPdfWVetro(valor: unknown, profundidade = 0, caminho = ''): string | null {
  if (profundidade > 8 || valor == null) return null
  if (typeof valor === 'string') {
    const s = valor.trim()
    if (!/^https?:\/\//i.test(s)) return null

    // O nome do campo pode conter "PDF" mas apontar para uma miniatura JPG/PNG.
    const urlSemParametros = s.split(/[?#]/)[0]
    if (/\.(?:jpe?g|png|gif|webp|svg|bmp|avif|heic|tiff?)$/i.test(urlSemParametros)) return null
    if (/[?&](?:format|mime|content[-_]?type)=(?:image(?:%2f|\/)|jpe?g|png|gif|webp|avif)/i.test(s)) return null
    if (/(?:thumbnail|thumb|miniatura|imagem|image|foto|preview)/i.test(caminho)) return null

    // Link sem extensão só é aceito quando o campo de origem o identifica como PDF.
    if (/\.pdf(?:$|[?#])/i.test(s) || /pdf/i.test(caminho)) return s
    return null
  }
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const achado = acharPdfWVetro(item, profundidade + 1, caminho)
      if (achado) return achado
    }
    return null
  }
  if (typeof valor !== 'object') return null
  for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
    const achado = acharPdfWVetro(item, profundidade + 1, caminho ? caminho + '.' + chave : chave)
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
