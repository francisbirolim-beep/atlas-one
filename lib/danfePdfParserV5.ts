import type { NFeItemNormalizado, NFeNormalizada } from '@/lib/nfeEntradaServer'
import { lerPdfDanfeV4 } from '@/lib/danfePdfParserV4'

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

function cnpjValido(cnpj: string) {
  const v = somenteDigitos(cnpj)
  if (v.length !== 14 || /^(\d)\1+$/.test(v)) return false
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split('').reduce((s, d, i) => s + Number(d) * (pesos[i] || 0), 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  const d1 = calc(v.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2])
  const d2 = calc(v.slice(0, 12) + d1, [6,5,4,3,2,9,8,7,6,5,4,3,2])
  return v.endsWith(`${d1}${d2}`)
}

function cnpjDaChave(chave: string) {
  const d = somenteDigitos(chave)
  if (d.length !== 44) return ''
  const cnpj = d.slice(6, 20)
  return cnpjValido(cnpj) ? cnpj : ''
}

function numeroBR(inteiro: string, centavos: string) {
  return Number(`${inteiro || '0'}.${centavos || '00'}`)
}

function parseValoresCompactos(resto: string) {
  const s = resto.replace(/\s+/g, '')
  const primeiraVirgula = s.indexOf(',')
  if (primeiraVirgula < 2) return null

  const prefixo = s.slice(0, primeiraVirgula)
  const centavosUnit = s.slice(primeiraVirgula + 1, primeiraVirgula + 3)
  const aposUnit = s.slice(primeiraVirgula + 3)
  if (!/^\d+$/.test(prefixo) || !/^\d{2}$/.test(centavosUnit)) return null

  const totalMatch = aposUnit.match(/^(\d+),(\d{2})/)
  if (!totalMatch) return null
  const valorTotal = numeroBR(totalMatch[1] || '', totalMatch[2] || '')

  let melhor: { quantidade: number; valorUnitario: number; valorTotal: number; erro: number } | null = null
  for (let corte = 1; corte < prefixo.length; corte += 1) {
    const quantidade = Number(prefixo.slice(0, corte))
    const inteiroUnit = prefixo.slice(corte)
    if (!quantidade || !inteiroUnit) continue
    const valorUnitario = numeroBR(inteiroUnit, centavosUnit)
    const erro = Math.abs(quantidade * valorUnitario - valorTotal)
    if (erro <= 0.05 && (!melhor || erro < melhor.erro)) {
      melhor = { quantidade, valorUnitario, valorTotal, erro }
    }
  }
  return melhor ? { quantidade: melhor.quantidade, valorUnitario: melhor.valorUnitario, valorTotal: melhor.valorTotal } : null
}

function parseLinhaCompacta(linha: string): NFeItemNormalizado | null {
  const normalizada = linha.replace(/\s+/g, ' ').trim()
  const m = normalizada.match(/^(.*?)\s+([A-Z0-9._\/-]{2,40})(\d{8})(\d{3})([1-7]\d{3})([A-Z]{1,8})(\d.*)$/i)
  if (!m) return null

  const descricao = (m[1] || '').trim()
  const codigo = (m[2] || '').trim()
  const ncm = m[3] || ''
  const cfop = m[5] || ''
  const unidade = m[6] || ''
  const valores = parseValoresCompactos(m[7] || '')
  if (!descricao || !codigo || !valores) return null

  return {
    codigoFornecedor: codigo,
    descricao,
    ncm,
    cfop,
    unidade,
    quantidade: valores.quantidade,
    valorUnitario: valores.valorUnitario,
    valorTotal: valores.valorTotal,
    dadosOrigem: {
      origemLeitura: 'pdf_danfe_v5_compacto',
      linha: normalizada.slice(0, 1800),
    },
  }
}

async function itensCompactos(buffer: Buffer) {
  const pdfParse = (await import('pdf-parse')).default
  const dados = await pdfParse(buffer)
  const linhas = (dados.text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .split(/\n/)
    .map(l => l.replace(/[\t]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const itens: NFeItemNormalizado[] = []
  const vistos = new Set<string>()
  for (const linha of linhas) {
    const item = parseLinhaCompacta(linha)
    if (!item) continue
    const chave = `${item.codigoFornecedor}|${item.quantidade}|${item.valorTotal}`
    if (!vistos.has(chave)) {
      vistos.add(chave)
      itens.push(item)
    }
  }
  return itens
}

export async function lerPdfDanfeV5(buffer: Buffer): Promise<NFeNormalizada> {
  const base = await lerPdfDanfeV4(buffer)
  const cnpjChave = !base.fornecedorCnpj ? cnpjDaChave(base.chaveAcesso || '') : ''
  if (base.itens.length) {
    return {
      ...base,
      fornecedorCnpj: base.fornecedorCnpj || cnpjChave,
    }
  }

  const compactos = await itensCompactos(buffer)
  if (!compactos.length) {
    return {
      ...base,
      fornecedorCnpj: base.fornecedorCnpj || cnpjChave,
      diagnostico: `${base.diagnostico || ''}; parser compacto v5: 0 item(ns)`.replace(/^;\s*/, ''),
    }
  }

  const soma = compactos.reduce((s, item) => s + (item.valorTotal || 0), 0)
  return {
    ...base,
    fornecedorCnpj: base.fornecedorCnpj || cnpjChave,
    valorProdutos: base.valorProdutos ?? soma,
    itens: compactos,
    avisos: [
      `PDF/DANFE: ${compactos.length} item(ns) identificado(s) pelo leitor compacto. Confira código, quantidade, unidade e valores antes de confirmar.`,
      ...(base.fornecedorCnpj || cnpjChave ? [] : ['CNPJ do emitente não foi identificado automaticamente; confira antes de confirmar.']),
    ],
    diagnostico: `${base.diagnostico || ''}; parser compacto v5: ${compactos.length} item(ns)`.replace(/^;\s*/, ''),
  }
}
