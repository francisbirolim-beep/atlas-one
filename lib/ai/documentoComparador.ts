export type ItemComparacao = {
  codigo: string
  quantidade: number
  detalhe: string
  cor?: string
}

function semAcento(valor: string) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizarCodigo(prefixo: string, numero?: string) {
  const p = String(prefixo || '').toUpperCase().replace(/[^A-Z]/g, '')
  const n = String(numero || '').replace(/\D/g, '')
  return p + n
}

function quantidadeNumero(valor: string) {
  const limpo = String(valor || '').toUpperCase().replace(/^O(?=\d)/, '0').replace(/[^0-9]/g, '')
  const n = Number(limpo)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function limparDetalhe(valor: string) {
  return semAcento(valor)
    .toUpperCase()
    .replace(/\b(UN|UND|UNID|UNIDADE|UNIDADES|PCS|PÇS|PECAS?)\b/g, ' ')
    .replace(/[=:;|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extrairItensComparacao(texto: string): ItemComparacao[] {
  const itens: ItemComparacao[] = []
  const linhas = String(texto || '').replace(/\r/g, '\n').split(/\n+/)

  for (const original of linhas) {
    const linha = original.replace(/[•·]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!linha || linha.length > 220) continue

    const m = linha.match(/^([A-Za-z]{2,5})\s*[- ]?\s*(\d{2,4})?\b(.*?)(?:\s*=\s*|\s+-\s+|\s+–\s+|\s+—\s+)([0O]?\d{1,3})\b(.*)$/i)
    if (!m) continue

    const codigo = normalizarCodigo(m[1], m[2])
    const quantidade = quantidadeNumero(m[4])
    if (!codigo || !quantidade) continue

    const detalhe = limparDetalhe(((m[3] || '') + ' ' + (m[5] || '')).trim())
    const corMatch = detalhe.match(/\b(PRETO|BRANCO|ANODIZADO FOSCO|FOSCO|IMBUIA|LINHEIRO CLARO|MARROM AVELA|CORTEN)\b/i)
    itens.push({
      codigo,
      quantidade,
      detalhe,
      cor: corMatch ? corMatch[1].toUpperCase() : undefined,
    })
  }

  if (itens.length >= 2) return consolidarItens(itens)

  // Fallback para texto extraído de PDF em que as colunas ficam coladas.
  const bruto = semAcento(String(texto || '')).toUpperCase()
  const rx = /\b(SU|DP|TMC|MG|NYL|PAR|CHU|CON|FIT|RPCS)\s*[- ]?\s*(\d{2,4})?\b[^\n]{0,55}?(?:=|\s-\s)\s*([0O]?\d{1,3})\b/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(bruto)) !== null) {
    const codigo = normalizarCodigo(m[1], m[2])
    const quantidade = quantidadeNumero(m[3])
    if (codigo && quantidade) itens.push({ codigo, quantidade, detalhe: '' })
  }

  return consolidarItens(itens)
}

function consolidarItens(itens: ItemComparacao[]) {
  const mapa = new Map<string, ItemComparacao>()
  for (const item of itens) {
    const atual = mapa.get(item.codigo)
    if (!atual) mapa.set(item.codigo, { ...item })
    else {
      atual.quantidade += item.quantidade
      if (!atual.detalhe && item.detalhe) atual.detalhe = item.detalhe
      if (!atual.cor && item.cor) atual.cor = item.cor
    }
  }
  return Array.from(mapa.values())
}

export function pareceListaDeItens(texto: string) {
  return extrairItensComparacao(texto).length >= 2
}

export async function extrairTextoDeAnexo(anexo: any): Promise<string> {
  if (!anexo || typeof anexo !== 'object') return ''
  if (anexo.tipo === 'texto') return String(anexo.dados || '').slice(0, 120000)
  if (anexo.tipo !== 'pdf' || !anexo.dados) return ''

  try {
    const buffer = Buffer.from(String(anexo.dados), 'base64')
    const pdfParse = (await import('pdf-parse')).default
    const dados = await pdfParse(buffer)
    return String(dados?.text || '').slice(0, 120000)
  } catch {
    return ''
  }
}

function detalheItem(item: ItemComparacao) {
  return item.codigo + ' — qtd. ' + item.quantidade + (item.cor ? ' — ' + item.cor : '')
}

export function compararListasItens(referencia: ItemComparacao[], recebido: ItemComparacao[]) {
  const ref = new Map(referencia.map(i => [i.codigo, i]))
  const rec = new Map(recebido.map(i => [i.codigo, i]))
  const faltando: string[] = []
  const extras: string[] = []
  const divergencias: string[] = []
  const cores: string[] = []

  for (const item of referencia) {
    const outro = rec.get(item.codigo)
    if (!outro) {
      faltando.push(detalheItem(item))
      continue
    }
    if (item.quantidade !== outro.quantidade) {
      divergencias.push(item.codigo + ': pedido ' + item.quantidade + ' / fornecedor ' + outro.quantidade)
    }
    if (item.cor && outro.cor && item.cor !== outro.cor) {
      cores.push(item.codigo + ': pedido ' + item.cor + ' / fornecedor ' + outro.cor)
    }
  }

  for (const item of recebido) {
    if (!ref.has(item.codigo)) extras.push(detalheItem(item))
  }

  const cab = 'Conferi ' + referencia.length + ' código(s) do pedido contra ' + recebido.length + ' código(s) identificados no material do fornecedor.'
  if (!faltando.length && !extras.length && !divergencias.length && !cores.length) {
    return cab + '\n\n✅ As quantidades e códigos identificados conferem.'
  }

  const blocos = [cab]
  if (faltando.length) blocos.push('\n❌ Faltando no fornecedor:\n' + faltando.map(v => '- ' + v).join('\n'))
  if (divergencias.length) blocos.push('\n⚠️ Quantidade diferente:\n' + divergencias.map(v => '- ' + v).join('\n'))
  if (cores.length) blocos.push('\n⚠️ Cor diferente:\n' + cores.map(v => '- ' + v).join('\n'))
  if (extras.length) blocos.push('\n➕ Item extra no fornecedor:\n' + extras.map(v => '- ' + v).join('\n'))
  return blocos.join('\n')
}
