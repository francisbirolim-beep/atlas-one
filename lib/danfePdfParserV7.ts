import type { NFeNormalizada, PagamentoNFe } from '@/lib/nfeEntradaServer'
import { lerPdfDanfeV6 } from '@/lib/danfePdfParserV6'

function numeroBR(valor: string) {
  const n = Number(valor.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function moedas(linha: string) {
  return Array.from(linha.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g))
    .map(m => numeroBR(m[1] || ''))
    .filter((n): n is number => n !== null)
}

function dataBrIso(valor: string) {
  const m = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : valor
}

function extrairPagamentos(texto: string): PagamentoNFe[] {
  const encontrados: PagamentoNFe[] = []
  const rx = /\b(\d{1,4})\s+(\d{2}\/\d{2}\/\d{4})\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g
  for (const m of texto.matchAll(rx)) {
    const valor = numeroBR(m[3] || '')
    if (valor === null) continue
    encontrados.push({ numero: m[1] || String(encontrados.length + 1), vencimento: dataBrIso(m[2] || ''), valor, forma: null })
  }
  return encontrados
}

function extrairTotaisFiscais(texto: string) {
  const inicio = texto.search(/C[ÁA]LCULO\s+DO\s+IMPOSTO/i)
  const fim = texto.search(/TRANSPORTADOR\/VOLUMES|TRANSPORTADOR/i)
  if (inicio < 0) return null
  const secao = texto.slice(inicio, fim > inicio ? fim : inicio + 4500)
  const linhas = secao.replace(/\r/g, '').split(/\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const linhasValores = linhas.map(l => ({ linha: l, vals: moedas(l) })).filter(x => x.vals.length >= 5)
  if (!linhasValores.length) return null
  const primeira = linhasValores[0]?.vals || []
  const segunda = linhasValores[1]?.vals || []
  return {
    baseIcms: primeira[0] ?? null,
    valorIcms: primeira[1] ?? null,
    baseIcmsSt: primeira[2] ?? null,
    valorIcmsSt: primeira[3] ?? null,
    valorProdutos: primeira[4] ?? null,
    valorFrete: segunda[0] ?? null,
    valorSeguro: segunda[1] ?? null,
    valorDesconto: segunda[2] ?? null,
    outrasDespesas: segunda[3] ?? null,
    valorIpi: segunda[4] ?? null,
    valorTotal: segunda[5] ?? null,
  }
}

function enriquecerTributosItem(item: NFeNormalizada['itens'][number]) {
  const linha = String(item.dadosOrigem?.linha || '')
  if (!linha) return item
  const valores = moedas(linha)
  const fiscal = valores.length >= 5 ? {
    baseIcms: valores[2] ?? null,
    valorIcms: valores[3] ?? null,
    valorIpi: valores[4] ?? null,
  } : {}

  const estrutura = linha.replace(/\s+/g, ' ').trim().match(/^(.*?)\s+([A-Z0-9._\/-]{2,50})(\d{8})(\d{3})([1-7]\d{3})([A-Z]{1,8})(\d.*)$/i)
  const cst = estrutura?.[4] || item.cst || ''
  let aliquotaIcms = item.aliquotaIcms ?? null
  let aliquotaIpi = item.aliquotaIpi ?? null
  const fim = linha.match(/\s(\d{1,3}(?:[.,]\d+)?)\s+(\d{1,3}(?:[.,]\d+)?)\s*$/)
  if (fim) {
    const a = Number((fim[1] || '').replace(',', '.'))
    const b = Number((fim[2] || '').replace(',', '.'))
    if (Number.isFinite(a) && a >= 0 && a <= 100) aliquotaIcms = a
    if (Number.isFinite(b) && b >= 0 && b <= 100) aliquotaIpi = b
  }
  return { ...item, cst, ...fiscal, aliquotaIcms, aliquotaIpi }
}

export async function lerPdfDanfeV7(buffer: Buffer): Promise<NFeNormalizada> {
  const base = await lerPdfDanfeV6(buffer)
  const pdfParse = (await import('pdf-parse')).default
  const dados = await pdfParse(buffer)
  const texto = (dados.text || '').replace(/\u00a0/g, ' ')
  const fiscal = extrairTotaisFiscais(texto)
  const pagamentos = extrairPagamentos(texto)
  const itens = base.itens.map(enriquecerTributosItem)

  const valorProdutos = fiscal?.valorProdutos ?? base.valorProdutos
  const valorTotal = fiscal?.valorTotal ?? base.valorTotal
  const soma = itens.reduce((s, i) => s + (Number(i.valorTotal) || 0), 0)
  const avisos = [...(base.avisos || [])]
  if (fiscal) avisos.push('Tributos principais do DANFE identificados em modo assistido. Para escrituração fiscal, prefira o XML da NF-e.')
  if (pagamentos.length) avisos.push(`${pagamentos.length} parcela(s) identificada(s) na fatura/duplicata para prévia de Contas a Pagar.`)
  if (valorProdutos !== null && Math.abs(soma - Number(valorProdutos)) > 0.02) avisos.push('A soma dos itens não fecha com o valor total dos produtos; a confirmação deve permanecer bloqueada.')

  return {
    ...base,
    itens,
    valorProdutos,
    valorTotal,
    baseIcms: fiscal?.baseIcms ?? base.baseIcms ?? null,
    valorIcms: fiscal?.valorIcms ?? base.valorIcms ?? null,
    baseIcmsSt: fiscal?.baseIcmsSt ?? base.baseIcmsSt ?? null,
    valorIcmsSt: fiscal?.valorIcmsSt ?? base.valorIcmsSt ?? null,
    valorIpi: fiscal?.valorIpi ?? base.valorIpi ?? null,
    valorFrete: fiscal?.valorFrete ?? base.valorFrete ?? null,
    valorSeguro: fiscal?.valorSeguro ?? base.valorSeguro ?? null,
    valorDesconto: fiscal?.valorDesconto ?? base.valorDesconto ?? null,
    outrasDespesas: fiscal?.outrasDespesas ?? base.outrasDespesas ?? null,
    pagamentos,
    avisos: Array.from(new Set(avisos)),
    diagnostico: `${base.diagnostico || ''}; parser v7 fiscal: ${fiscal ? 'ok' : 'n/d'}; pagamentos=${pagamentos.length}`.replace(/^;\s*/, ''),
  }
}
