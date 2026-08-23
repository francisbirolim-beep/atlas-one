import type { NFeItemNormalizado, NFeNormalizada } from '@/lib/nfeEntradaServer'

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

function numeroBR(valor: string | undefined | null): number | null {
  const txt = String(valor ?? '').trim()
  if (!txt) return null
  const limpo = txt.replace(/R\$/gi, '').replace(/\s/g, '')
  const normalizado = limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

function dataIsoBr(valor: string) {
  const m = valor.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}T12:00:00.000Z` : ''
}

function numeroDocumento(valor: string) {
  const digitos = somenteDigitos(valor).slice(0, 9)
  if (!digitos) return ''
  return digitos.replace(/^0+(?=\d)/, '')
}

function valorPertoDoRotulo(texto: string, rotulos: RegExp[]) {
  for (const rotulo of rotulos) {
    const m = rotulo.exec(texto)
    if (!m) continue
    const trecho = texto.slice(m.index + m[0].length, m.index + m[0].length + 260)
    const valores = Array.from(trecho.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/g))
    for (const valor of valores) {
      const n = numeroBR(valor[1])
      if (n !== null) return n
    }
  }
  return null
}

function extrairChave(texto: string) {
  const indice = texto.search(/CHAVE\s+DE\s+ACESSO/i)
  if (indice >= 0) {
    const perto = texto.slice(indice, indice + 500)
    const candidato = perto.match(/(?:\d[\s.\-]?){44}/)?.[0]
    const digitos = somenteDigitos(candidato || '')
    if (digitos.length >= 44) return digitos.slice(0, 44)
  }

  for (const candidato of texto.match(/(?:\d[\s.\-]?){44}/g) || []) {
    const digitos = somenteDigitos(candidato)
    if (digitos.length >= 44) return digitos.slice(0, 44)
  }
  return ''
}

function extrairNumero(texto: string) {
  const padroes = [
    /(?:N[º°o]\.?|NÚMERO|NUMERO)\s*[:\-]?\s*([0-9][0-9.\s\-]{0,18})/i,
    /NF[-\s]?E\s*[:\-]?\s*([0-9][0-9.\s\-]{0,18})/i,
  ]
  for (const padrao of padroes) {
    const valor = texto.match(padrao)?.[1]
    if (valor) {
      const numero = numeroDocumento(valor)
      if (numero) return numero
    }
  }
  return ''
}

function extrairSerie(texto: string) {
  const valor = texto.match(/S[ÉE]RIE\s*[:\-]?\s*([0-9][0-9.\s\-]{0,8})/i)?.[1] || ''
  const digitos = somenteDigitos(valor).slice(0, 4)
  return digitos ? digitos.replace(/^0+(?=\d)/, '') : ''
}

function extrairCnpjEmitente(texto: string) {
  const limiteDestinatario = texto.search(/DESTINAT[ÁA]RIO\s*\/?\s*REMETENTE/i)
  const topo = texto.slice(0, limiteDestinatario > 0 ? limiteDestinatario : Math.min(texto.length, 7000))
  const encontrados = topo.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/g) || []
  for (const valor of encontrados) {
    const digitos = somenteDigitos(valor)
    if (digitos.length === 14) return digitos
  }
  return ''
}

function linhaPareceRotulo(linha: string) {
  return /^(DANFE|DOCUMENTO AUXILIAR|NOTA FISCAL|CHAVE DE ACESSO|PROTOCOLO|NATUREZA DA OPERA|INSCRIÇÃO|CNPJ|FOLHA|S[ÉE]RIE|N[º°O])/i.test(linha)
}

function extrairFornecedor(texto: string) {
  const recebemos = texto.match(/RECEBEMOS\s+DE\s+(.+?)(?:\s+OS\s+PRODUTOS|\s+E\s+\/\s+OU\s+SERVIÇOS|\n)/i)?.[1]?.trim()
  if (recebemos && recebemos.length >= 3 && recebemos.length <= 180) return recebemos

  const linhas = texto
    .slice(0, Math.min(texto.length, 3500))
    .split(/\r?\n/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const indiceDanfe = linhas.findIndex(l => /\bDANFE\b/i.test(l))
  const candidatas = (indiceDanfe > 0 ? linhas.slice(0, indiceDanfe) : linhas.slice(0, 12))
    .filter(l => !linhaPareceRotulo(l))
    .filter(l => !/RECEBEMOS|DATA DE RECEBIMENTO|IDENTIFICAÇÃO E ASSINATURA|OS PRODUTOS/i.test(l))
    .filter(l => !/^\d[\d\s.\-\/]+$/.test(l))
    .filter(l => l.length >= 3 && l.length <= 180)

  return candidatas[0] || ''
}

function secaoItens(texto: string) {
  const inicioMatch = texto.match(/DADOS\s+(?:DOS?\s+)?PRODUTOS?\s*\/?\s*SERVI[ÇC]OS?/i)
  if (!inicioMatch || inicioMatch.index === undefined) return ''
  const inicio = inicioMatch.index + inicioMatch[0].length
  const resto = texto.slice(inicio)
  const fimMatch = resto.match(/\n\s*(?:C[ÁA]LCULO\s+DO\s+ISSQN|DADOS\s+ADICIONAIS|INFORMA[ÇC][ÕO]ES\s+COMPLEMENTARES|RESERVADO\s+AO\s+FISCO)/i)
  const fim = fimMatch?.index ?? Math.min(resto.length, 30000)
  return resto.slice(0, fim)
}

function tokenNumero(token: string) {
  return /^-?\d+(?:[.,]\d+)*(?:,\d+)?$/.test(token.replace(/R\$/gi, ''))
}

function parseLinhaProduto(linha: string): NFeItemNormalizado | null {
  const normalizada = linha.replace(/\s+/g, ' ').trim()
  if (!normalizada || /C[ÓO]DIGO.*DESCRI|NCM\/?SH|VALOR\s+UNIT|VALOR\s+TOTAL/i.test(normalizada)) return null

  const ncmMatch = normalizada.match(/\b\d{8}\b/)
  if (!ncmMatch || ncmMatch.index === undefined) return null

  const antesNcm = normalizada.slice(0, ncmMatch.index).trim()
  const depoisNcm = normalizada.slice(ncmMatch.index + ncmMatch[0].length).trim()
  const prefixo = antesNcm.split(' ').filter(Boolean)
  if (prefixo.length < 2) return null

  const codigo = prefixo.shift() || ''
  const descricao = prefixo.join(' ').trim()
  if (!codigo || !descricao) return null

  const tokens = depoisNcm.split(' ').filter(Boolean)
  let cfopIndex = -1
  for (let i = 0; i < Math.min(tokens.length, 4); i += 1) {
    if (/^[1-7]\d{3}$/.test(tokens[i])) {
      cfopIndex = i
      break
    }
  }
  if (cfopIndex < 0) return null

  const unidade = tokens[cfopIndex + 1] || ''
  if (!/^[A-ZÀ-Ú%]{1,8}$/i.test(unidade)) return null

  const numeros: string[] = []
  for (let i = cfopIndex + 2; i < tokens.length && numeros.length < 3; i += 1) {
    if (tokenNumero(tokens[i])) numeros.push(tokens[i])
    else if (numeros.length) break
  }
  if (numeros.length < 3) return null

  const quantidade = numeroBR(numeros[0])
  const valorUnitario = numeroBR(numeros[1])
  const valorTotal = numeroBR(numeros[2])
  if (quantidade === null || quantidade <= 0 || valorUnitario === null || valorTotal === null) return null

  return {
    codigoFornecedor: codigo,
    descricao,
    ncm: ncmMatch[0],
    cfop: tokens[cfopIndex],
    unidade,
    quantidade,
    valorUnitario,
    valorTotal,
    dadosOrigem: { origemLeitura: 'pdf_danfe', linha: normalizada.slice(0, 1500) },
  }
}

function extrairItens(texto: string) {
  const secao = secaoItens(texto)
  if (!secao) return { itens: [] as NFeItemNormalizado[], secaoEncontrada: false, linhas: 0 }

  const linhas = secao
    .split(/\r?\n/)
    .map(l => l.replace(/[\t]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(l => !/^(C[ÓO]DIGO|DESCRI[ÇC][ÃA]O|NCM|CST|CFOP|UNID|QUANT|VALOR|BC\.?\s*ICMS|AL[ÍI]Q)/i.test(l))

  const itens: NFeItemNormalizado[] = []
  const vistos = new Set<string>()

  for (let i = 0; i < linhas.length; i += 1) {
    let combinado = ''
    let encontrado: NFeItemNormalizado | null = null
    let consumidas = 1

    for (let janela = 0; janela < 4 && i + janela < linhas.length; janela += 1) {
      combinado = `${combinado} ${linhas[i + janela]}`.trim()
      encontrado = parseLinhaProduto(combinado)
      if (encontrado) {
        consumidas = janela + 1
        break
      }
    }

    if (!encontrado) continue
    const chave = `${encontrado.codigoFornecedor}|${encontrado.descricao}|${encontrado.quantidade}|${encontrado.valorTotal}`
    if (!vistos.has(chave)) {
      vistos.add(chave)
      itens.push(encontrado)
    }
    i += consumidas - 1
  }

  return { itens, secaoEncontrada: true, linhas: linhas.length }
}

export async function lerPdfDanfeAvancado(buffer: Buffer): Promise<NFeNormalizada> {
  const pdfParse = (await import('pdf-parse')).default
  const dados = await pdfParse(buffer)
  const texto = (dados.text || '').replace(/\u00a0/g, ' ').replace(/\r/g, '')
  const compacto = texto.replace(/[ \t]+/g, ' ')

  const chaveAcesso = extrairChave(compacto)
  const numero = extrairNumero(compacto)
  const serie = extrairSerie(compacto)
  const cnpj = extrairCnpjEmitente(texto)
  const fornecedorNome = extrairFornecedor(texto)
  const emissao = compacto.match(/(?:DATA\s+DE\s+EMISS[ÃA]O|EMISS[ÃA]O)\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || ''
  const extraidos = extrairItens(texto)

  const valorTotal = valorPertoDoRotulo(compacto, [
    /VALOR\s+TOTAL\s+DA\s+NOTA/i,
    /V\.?\s*TOTAL\s+DA\s+NOTA/i,
  ])
  const valorProdutosRotulo = valorPertoDoRotulo(compacto, [
    /VALOR\s+TOTAL\s+DOS\s+PRODUTOS/i,
    /V\.?\s*TOTAL\s+DOS\s+PRODUTOS/i,
  ])
  const somaItens = extraidos.itens.reduce((s, item) => s + (item.valorTotal || 0), 0)
  const valorProdutos = valorProdutosRotulo ?? (extraidos.itens.length ? somaItens : null)

  const avisos: string[] = []
  if (extraidos.itens.length) {
    avisos.push(`PDF/DANFE: ${extraidos.itens.length} item(ns) identificado(s) automaticamente. Confira código, quantidade, unidade e valores antes de confirmar.`)
  } else {
    avisos.push('O PDF/DANFE não permitiu identificar automaticamente a tabela de itens. Use Adicionar item ou, quando disponível, importe o XML da NF-e.')
  }
  if (!fornecedorNome) avisos.push('Fornecedor não foi identificado automaticamente no PDF; confira e preencha antes de confirmar.')
  if (!cnpj) avisos.push('CNPJ do emitente não foi identificado automaticamente no PDF; confira e preencha se necessário.')
  if (!numero) avisos.push('Número da NF não foi identificado automaticamente no PDF.')

  return {
    origem: 'pdf',
    chaveAcesso,
    numero,
    serie,
    dataEmissao: dataIsoBr(emissao),
    fornecedorNome,
    fornecedorCnpj: cnpj,
    valorProdutos,
    valorTotal,
    itens: extraidos.itens,
    avisos,
    diagnostico: `PDF DANFE: ${dados.numpages || 0} página(s); seção de itens ${extraidos.secaoEncontrada ? 'encontrada' : 'não encontrada'}; ${extraidos.linhas} linha(s) analisada(s); ${extraidos.itens.length} item(ns) extraído(s).`,
  }
}
