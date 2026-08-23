import type { NFeItemNormalizado, NFeNormalizada } from '@/lib/nfeEntradaServer'
import { lerPdfDanfeV5 } from '@/lib/danfePdfParserV5'

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

function numeroBRTexto(valor: string) {
  const limpo = valor.replace(/\./g, '').replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
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

function extrairChaveRobusta(texto: string) {
  const indice = texto.search(/CHAVE\s+DE\s+ACESSO/i)
  const base = indice >= 0 ? texto.slice(indice, indice + 1400) : texto
  const candidatos = base.match(/(?:\d{4}[\s.\-]*){10}\d{4}/g) || []
  for (const candidato of candidatos) {
    const digitos = somenteDigitos(candidato)
    if (digitos.length === 44) return digitos
  }
  return ''
}

function cnpjDaChave(chave: string) {
  const d = somenteDigitos(chave)
  if (d.length !== 44) return ''
  const cnpj = d.slice(6, 20)
  return cnpjValido(cnpj) ? cnpj : ''
}

function extrairCnpjEmitente(texto: string, chave: string) {
  const indiceEmitente = texto.search(/IDENTIFICA[ÇC][ÃA]O\s+DO\s+EMITENTE/i)
  if (indiceEmitente >= 0) {
    const trecho = texto.slice(indiceEmitente, indiceEmitente + 7000)
    const fimProdutos = trecho.search(/DADOS\s+DO\s+PRODUTO/i)
    const secao = fimProdutos > 0 ? trecho.slice(0, fimProdutos) : trecho
    const encontrados = secao.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g) || []
    for (const encontrado of encontrados) {
      const digitos = somenteDigitos(encontrado)
      if (cnpjValido(digitos)) return digitos
    }
  }
  return cnpjDaChave(chave)
}

function separarCodigoERuido(candidato: string) {
  const limpo = candidato.trim()
  const m = limpo.match(/(ALS\d+[A-Z0-9]*|AL\d{3}[A-Z0-9]*)$/i)
  if (!m || m.index === undefined) return { codigo: limpo, ruido: '' }
  return {
    codigo: m[1] || limpo,
    ruido: limpo.slice(0, m.index).trim(),
  }
}

function juntarDescricao(base: string, ruido: string, continuacoes: string[]) {
  const partes = [base.trim()]
  if (ruido) partes.push(ruido)
  for (const c of continuacoes) {
    const t = c.trim()
    if (t) partes.push(t)
  }
  return partes
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+-\s+-\s+/g, ' - ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim()
}

function parseValoresCompactos(resto: string) {
  const s = resto.replace(/\s+/g, '')
  const primeiraVirgula = s.indexOf(',')
  if (primeiraVirgula < 2) return null

  const prefixo = s.slice(0, primeiraVirgula)
  const centavosUnit = s.slice(primeiraVirgula + 1, primeiraVirgula + 3)
  const aposUnit = s.slice(primeiraVirgula + 3)
  if (!/^\d+$/.test(prefixo) || !/^\d{2}$/.test(centavosUnit)) return null

  const totalMatch = aposUnit.match(/^(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/)
  if (!totalMatch) return null
  const valorTotal = numeroBRTexto(`${totalMatch[1]},${totalMatch[2]}`)
  if (valorTotal === null) return null

  let melhor: { quantidade: number; valorUnitario: number; valorTotal: number; erro: number } | null = null
  for (let corte = 1; corte < prefixo.length; corte += 1) {
    const quantidade = Number(prefixo.slice(0, corte))
    const inteiroUnit = prefixo.slice(corte)
    if (!quantidade || !inteiroUnit) continue
    const valorUnitario = Number(`${inteiroUnit}.${centavosUnit}`)
    const erro = Math.abs(quantidade * valorUnitario - valorTotal)
    if (erro <= 0.02 && (!melhor || erro < melhor.erro)) {
      melhor = { quantidade, valorUnitario, valorTotal, erro }
    }
  }

  return melhor ? { quantidade: melhor.quantidade, valorUnitario: melhor.valorUnitario, valorTotal: melhor.valorTotal } : null
}

function parseLinhaCompacta(linha: string) {
  const normalizada = linha.replace(/\s+/g, ' ').trim()
  const m = normalizada.match(/^(.*?)\s+([A-Z0-9._\/-]{2,50})(\d{8})(\d{3})([1-7]\d{3})([A-Z]{1,8})(\d.*)$/i)
  if (!m) return null

  const descricaoBase = (m[1] || '').trim()
  const codigoBruto = (m[2] || '').trim()
  const ncm = m[3] || ''
  const cfop = m[5] || ''
  const unidade = m[6] || ''
  const valores = parseValoresCompactos(m[7] || '')
  if (!descricaoBase || !codigoBruto || !valores) return null

  const separado = separarCodigoERuido(codigoBruto)
  return {
    item: {
      codigoFornecedor: separado.codigo,
      descricao: descricaoBase,
      ncm,
      cfop,
      unidade,
      quantidade: valores.quantidade,
      valorUnitario: valores.valorUnitario,
      valorTotal: valores.valorTotal,
      dadosOrigem: {
        origemLeitura: 'pdf_danfe_v6_compacto',
        codigoBruto,
        linha: normalizada.slice(0, 1800),
      },
    } satisfies NFeItemNormalizado,
    ruidoDescricao: separado.ruido,
  }
}

function ehContinuacaoDescricao(linha: string) {
  if (!linha) return false
  if (/^(FOLHA|DADOS ADICIONAIS|INFORMA[ÇC][ÕO]ES|RESERVADO|C[ÁA]LCULO|TRANSPORTADOR|DESTINAT[ÁA]RIO|IDENTIFICA[ÇC][ÃA]O|CHAVE|PROTOCOLO)/i.test(linha)) return false
  if (/\d{8}\d{3}[1-7]\d{3}[A-Z]{1,8}\d/i.test(linha.replace(/\s+/g, ''))) return false
  return linha.length <= 120
}

async function extrairCompactosV6(buffer: Buffer) {
  const pdfParse = (await import('pdf-parse')).default
  const dados = await pdfParse(buffer)
  const texto = (dados.text || '').replace(/\u00a0/g, ' ').replace(/\r/g, '')
  const linhas = texto
    .split(/\n/)
    .map(l => l.replace(/[\t]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const itens: NFeItemNormalizado[] = []
  const vistos = new Set<string>()

  for (let i = 0; i < linhas.length; i += 1) {
    const atual = parseLinhaCompacta(linhas[i] || '')
    if (!atual) continue

    const continuacoes: string[] = []
    for (let j = i + 1; j < Math.min(linhas.length, i + 4); j += 1) {
      const proxima = linhas[j] || ''
      if (parseLinhaCompacta(proxima)) break
      if (!ehContinuacaoDescricao(proxima)) break
      continuacoes.push(proxima)
    }

    atual.item.descricao = juntarDescricao(atual.item.descricao, atual.ruidoDescricao, continuacoes)
    const chave = `${atual.item.codigoFornecedor}|${atual.item.quantidade}|${atual.item.valorTotal}`
    if (!vistos.has(chave)) {
      vistos.add(chave)
      itens.push(atual.item)
    }
  }

  const chaveAcesso = extrairChaveRobusta(texto)
  const cnpj = extrairCnpjEmitente(texto, chaveAcesso)
  return { itens, chaveAcesso, cnpj }
}

export async function lerPdfDanfeV6(buffer: Buffer): Promise<NFeNormalizada> {
  const base = await lerPdfDanfeV5(buffer)
  const extra = await extrairCompactosV6(buffer)
  const itens = extra.itens.length >= base.itens.length ? extra.itens : base.itens
  const chaveAcesso = extra.chaveAcesso || base.chaveAcesso
  const fornecedorCnpj = extra.cnpj || base.fornecedorCnpj || cnpjDaChave(chaveAcesso || '')
  const soma = itens.reduce((s, item) => s + (Number(item.valorTotal) || 0), 0)
  const valorProdutos = base.valorProdutos ?? (itens.length ? soma : null)
  const diferenca = valorProdutos == null ? null : Math.abs(soma - valorProdutos)

  const avisos: string[] = []
  if (itens.length) {
    avisos.push(`PDF/DANFE: ${itens.length} item(ns) identificado(s). Confira os dados antes de confirmar.`)
  } else {
    avisos.push('O PDF/DANFE não permitiu identificar automaticamente os itens. Prefira o XML ou faça o lançamento manual.')
  }
  if (!fornecedorCnpj) avisos.push('CNPJ do emitente não foi identificado automaticamente; confira antes de confirmar.')
  if (diferenca !== null && diferenca > 0.02) {
    avisos.push(`DIVERGÊNCIA: a soma dos itens (${soma.toFixed(2)}) não fecha com o valor dos produtos da NF (${Number(valorProdutos).toFixed(2)}). A confirmação deve permanecer bloqueada até a correção.`)
  }

  return {
    ...base,
    chaveAcesso,
    fornecedorCnpj,
    valorProdutos,
    itens,
    avisos,
    diagnostico: `${base.diagnostico || ''}; parser v6: itens=${itens.length}; soma=${soma.toFixed(2)}; valorProdutos=${valorProdutos ?? 'n/d'}; diferenca=${diferenca ?? 'n/d'}`.replace(/^;\s*/, ''),
  }
}
