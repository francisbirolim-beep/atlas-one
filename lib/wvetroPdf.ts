import { ItemEsquadria, TipoEsquadria } from './tipos'
import { inferirTipoEsquadria, parseItensDoTextoPdf } from './pdfOrcamentoImport'

export interface WVetroPdfItem {
  ambiente: string | null
  tipo_esquadria: TipoEsquadria
  tipo_outro_texto: string | null
  descricao: string
  quantidade: number
  largura_mm: number
  altura_mm: number
  cor: string | null
  linha: string | null
  vidro: string | null
}

export interface WVetroPdfResumo {
  parece_wvetro: boolean
  numero_orcamento: string | null
  cliente_nome: string | null
  cidade: string | null
  uf: string | null
  valor_total: number | null
  itens: WVetroPdfItem[]
}

function linhasNormalizadas(textoBruto: string) {
  return (textoBruto || '')
    .split(/\r?\n/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function limparValorRotulo(linha: string, rx: RegExp) {
  const match = linha.match(rx)
  return match?.[1]?.trim() || ''
}

function numeroMedida(valor: string | undefined): number | null {
  if (!valor) return null
  const limpo = valor.trim()
  const normalizado = /^\d{1,3}\.\d{3}$/.test(limpo)
    ? limpo.replace('.', '')
    : limpo.replace(',', '.')
  const numero = Number(normalizado)
  return Number.isFinite(numero) && numero > 0 ? numero : null
}

function numeroMoeda(valor: string): number | null {
  const bruto = (valor || '').replace(/[^\d.,-]/g, '')
  if (!bruto) return null

  let normalizado = bruto
  if (/^-?\d{1,3}(?:\.\d{3})+,\d{2}$/.test(bruto)) {
    normalizado = bruto.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d+,\d{2}$/.test(bruto)) {
    normalizado = bruto.replace(',', '.')
  } else if (/^-?\d{1,3}(?:,\d{3})+\.\d{2}$/.test(bruto)) {
    normalizado = bruto.replace(/,/g, '')
  }

  const numero = Number(normalizado)
  return Number.isFinite(numero) ? numero : null
}

function extrairNumeroOrcamento(linhas: string[]) {
  for (const linha of linhas) {
    const match = linha.match(/(?:CEP\s*)?N(?:U|Ú)MERO\s*:\s*(\d+)/i)
      || linha.match(/\bOR[ÇC]AMENTO\s*(?:N(?:U|Ú)MERO|N[º°.]?)?\s*[:#-]?\s*(\d{2,})/i)
    if (match?.[1]) return match[1]
  }
  return null
}

function nomePossivelCliente(valor: string) {
  if (!valor) return null

  let candidato = valor.replace(/\s+/g, ' ').trim()
  if (!candidato || candidato.length < 2 || candidato.length > 120) return null
  if (/^(CLIENTE|TEL|EMAIL|CNPJ|CPF|ENDERE[ÇC]O|CEP|IE\/RG|TEL2|FAX|DATA|TIPO|ITEM|OR[ÇC]AMENTO)\b/i.test(candidato)) return null
  if (/WVETRO|W\.VETRO|SISTEMA PARA VIDRA/i.test(candidato)) return null
  if (/@/.test(candidato) || /\bCEP\s*:/i.test(candidato)) return null
  if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(candidato)) return null

  // Alguns PDFs colocam nome e celular na mesma linha, antes do rótulo CLIENTE.
  candidato = candidato
    .replace(/\s+\(?\d{2}\)?\s*\d{4,5}-?\d{4}.*$/i, '')
    .trim()

  if (!candidato || /\d/.test(candidato)) return null
  if (!/[A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]{2,}/i.test(candidato)) return null
  return candidato
}

function extrairCliente(linhas: string[]) {
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    if (!linha) continue

    const inline = linha.match(/^CLIENTE\s*:\s*(.+)$/i)
    if (inline?.[1]) {
      const antesDeOutrosRotulos = inline[1].split(/\s+(?:TEL\.?\s*FIXO|CELULAR|EMAIL|CNPJ|CPF|ENDERE[ÇC]O)\s*:/i)[0] || ''
      const nomeInline = nomePossivelCliente(antesDeOutrosRotulos)
      if (nomeInline) return nomeInline
    }

    if (/^CLIENTE\s*:/i.test(linha)) {
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const nome = nomePossivelCliente(linhas[j] || '')
        if (nome) return nome
      }
    }
  }

  return null
}

function extrairCidadeUf(linhas: string[]) {
  for (const linha of linhas) {
    if (!/CEP\s*:/i.test(linha) && !/\/[A-Z]{2}\b/.test(linha)) continue

    const match = linha.match(/-\s*([^\/-]{2,}?)\s*\/\s*([A-Z]{2})\s*-?/i)
      || linha.match(/\b([A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ][A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ\s.'-]{2,})\s*\/\s*([A-Z]{2})\b/i)
    if (match?.[1] && match?.[2]) {
      return { cidade: match[1].trim().replace(/^[-,\s]+|[-,\s]+$/g, ''), uf: match[2].toUpperCase() }
    }
  }
  return { cidade: null, uf: null }
}

function extrairTotal(linhas: string[]) {
  const idxTotal = linhas.findIndex(l => /^TOTAL\s*:/i.test(l))
  if (idxTotal >= 0) {
    const inline = limparValorRotulo(linhas[idxTotal] || '', /^TOTAL\s*:\s*(.+)$/i)
    const valorInline = numeroMoeda(inline)
    if (valorInline != null) return valorInline

    for (let i = idxTotal - 1; i >= Math.max(0, idxTotal - 10); i--) {
      const candidatos = (linhas[i] || '').match(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2}/g) || []
      for (let j = candidatos.length - 1; j >= 0; j--) {
        const valor = numeroMoeda(candidatos[j] || '')
        if (valor != null) return valor
      }
    }
  }

  return null
}

function candidatoAmbienteAntesDoRotulo(linhas: string[], idxLocal: number) {
  for (let i = idxLocal - 1; i >= Math.max(0, idxLocal - 4); i--) {
    const valor = linhas[i] || ''
    if (!valor) continue
    if (/\d{1,3}(?:\.\d{3})*,\d{2}/.test(valor)) continue
    if (/^\d+$/.test(valor)) continue
    if (/^(ITEM|TIPO|OR[ÇC]AMENTO)/i.test(valor)) continue
    if (/^(PORTA|JANELA|MAXIM|FACHADA|PAINEL|REVESTIMENTO|VITR|BOX|GUARDA|LAMBRI|PORTINHOLA)/i.test(valor)) continue
    if (valor.length <= 60) return valor
  }
  return null
}

function extrairQtdMedidas(bloco: string[]) {
  const idxCabecalho = bloco.findIndex(l => /^QTDE\.?\s+LARGURA\s*:\s*ALTURA/i.test(l) || /^QTDE\.?\s+LARGURA/i.test(l))
  if (idxCabecalho >= 0) {
    for (let i = idxCabecalho + 1; i < Math.min(bloco.length, idxCabecalho + 6); i++) {
      const numeros = (bloco[i] || '').match(/\d+(?:[.,]\d+)?/g) || []
      if (numeros.length < 3) continue
      const quantidade = Math.max(1, parseInt((numeros[0] || '1').replace(/\D/g, ''), 10) || 1)
      const largura = numeroMedida(numeros[1])
      const altura = numeroMedida(numeros[2])
      if (largura && altura) return { quantidade, largura, altura }
    }
  }
  return null
}

function extrairQuantidadeSemMedidas(bloco: string[]) {
  const idxCabecalho = bloco.findIndex(l => /\bQTDE\.?\b/i.test(l))
  if (idxCabecalho < 0) return 1

  for (let i = idxCabecalho + 1; i < Math.min(bloco.length, idxCabecalho + 7); i++) {
    const linha = bloco[i] || ''
    const codigoQuantidade = linha.match(/^[A-Z0-9.-]{1,10}\s+(\d{1,3})(?:\s|$)/i)
    if (codigoQuantidade?.[1]) return Math.max(1, parseInt(codigoQuantidade[1], 10) || 1)
    if (/^\d{1,3}$/.test(linha)) return Math.max(1, parseInt(linha, 10) || 1)
  }

  return 1
}

function extrairProdutoDoBloco(bloco: string[]) {
  const rxProduto = /^(PORTA|JANELA|MAXIM|FACHADA|PAINEL|REVESTIMENTO|VITR|BOX|GUARDA|LAMBRI|PORTINHOLA)/i
  const idxProduto = bloco.findIndex(l => rxProduto.test(l))
  if (idxProduto < 0) return ''

  const partes: string[] = []
  for (let i = idxProduto; i < Math.min(bloco.length, idxProduto + 5); i++) {
    let valor = bloco[i] || ''
    if (!valor) continue
    if (i > idxProduto && /(\*COR\s|\bQTDE\.?\b|\bVLR\.?\b|\bDT\.?\s*INSTALA|\bITEM\s*NRO\b|^TIPO\s*2\b|^OBSERVA[ÇC][ÕO]ES\b)/i.test(valor)) break
    if (i > idxProduto && /^(PINTURA|INCOLOR|MINI[- ]?BOREAL|LAMINADO|TEMPERADO|REFLETIVO)/i.test(valor)) break
    valor = valor.replace(/\s+ITEM\s*NRO\s*:\s*\d+.*$/i, '').trim()
    if (valor) partes.push(valor)
  }

  return partes.join(' ').replace(/\s+/g, ' ').trim()
}

function extrairLinhaProduto(produto: string) {
  const match = produto.match(/\|\s*([^|]+)/)
  if (!match?.[1]) return ''
  return match[1]
    .replace(/\s+(?:COM|SEM)\b.*$/i, '')
    .trim()
}

function extrairCorPerfil(bloco: string[]) {
  // Prefere a pintura, pois alguns PDFs misturam visualmente a cor do acessório
  // com o rótulo de cor do perfil durante a extração de texto.
  for (const linha of bloco) {
    const pintura = linha.match(/\bPINTURA\s+([A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ][A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ\s.-]{1,30}?)(?=\s+\*|$)/i)
    if (pintura?.[0]) return pintura[0].trim()
  }

  for (const linha of bloco) {
    const match = linha.match(/\*COR\s+(?:PERFIL|ESQUADRIA)\s*:\s*(.*?)(?=\s+\*COR\s|$)/i)
    if (match?.[1]?.trim()) return match[1].trim()
  }

  return ''
}

function extrairVidroBloco(bloco: string[]) {
  const rxVidro = /(?:MINI[- ]?BOREAL|BOREAL|INCOLOR|REFLETIVO|LAMINADO|TEMPERADO|VIDRO)[^|]*?\b\d{1,2}\s*MM\b[^|]*/i

  for (const linha of bloco) {
    const match = linha.match(rxVidro)
    if (match?.[0]) return match[0].trim().replace(/^\*COR\s+VIDRO\s*:?[\s-]*/i, '')
  }

  return ''
}

function extrairItensPorRotulos(linhas: string[]): WVetroPdfItem[] {
  const locais = linhas
    .map((linha, index) => /^\*?LOCAL\s*\/\s*AMBIENTE\s*:/i.test(linha) ? index : -1)
    .filter(index => index >= 0)

  const itens: WVetroPdfItem[] = []

  for (let pos = 0; pos < locais.length; pos++) {
    const idxLocal = locais[pos] ?? -1
    if (idxLocal < 0) continue
    const proximoLocal = pos + 1 < locais.length ? (locais[pos + 1] ?? linhas.length) : linhas.length
    const fim = Math.min(proximoLocal, idxLocal + 36)
    const bloco = linhas.slice(idxLocal, fim)

    const localLinha = linhas[idxLocal] || ''
    const ambienteInline = limparValorRotulo(localLinha, /^\*?LOCAL\s*\/\s*AMBIENTE\s*:\s*(.*)$/i)
      .replace(/\s+ITEM\s*NRO\s*:\s*\d+.*$/i, '')
      .trim()
    const ambiente = ambienteInline || candidatoAmbienteAntesDoRotulo(linhas, idxLocal)

    const produto = extrairProdutoDoBloco(bloco)
    if (!produto) continue

    const medidas = extrairQtdMedidas(bloco)
    const quantidade = medidas?.quantidade || extrairQuantidadeSemMedidas(bloco)
    const largura = medidas?.largura || 0
    const altura = medidas?.altura || 0

    const linha = extrairLinhaProduto(produto)
    const corPerfil = extrairCorPerfil(bloco)
    const vidro = extrairVidroBloco(bloco)

    const tipo = inferirTipoEsquadria(produto)
    const descricao = [
      produto,
      linha ? `LINHA: ${linha}` : '',
      vidro ? `VIDRO: ${vidro}` : '',
      corPerfil ? `COR PERFIL: ${corPerfil}` : '',
      largura > 0 && altura > 0 ? '' : 'MEDIDAS NÃO INFORMADAS NO PDF',
    ].filter(Boolean).join(' | ')

    itens.push({
      ambiente: ambiente || null,
      tipo_esquadria: tipo,
      tipo_outro_texto: tipo === 'outro' ? produto : null,
      descricao,
      quantidade,
      largura_mm: largura,
      altura_mm: altura,
      cor: corPerfil || null,
      linha: linha || null,
      vidro: vidro || null,
    })
  }

  return itens
}

function converterFallback(itens: Partial<ItemEsquadria>[]): WVetroPdfItem[] {
  return itens
    .filter(it => !!(it.descricao || it.tipo_outro_texto || it.ambiente))
    .map(it => {
      const descricao = (it.descricao || it.tipo_outro_texto || it.ambiente || '').trim()
      const matchLinha = descricao.match(/(?:^|\|)\s*LINHA\s*:\s*([^|]+)/i)
        || descricao.match(/\|\s*(SUPREMA|GOLD|LINHA\s*\d+|ATLANTA|PELE\s+DE\s+VIDRO)\b/i)
      const matchVidro = descricao.match(/(?:^|\|)\s*VIDRO\s*:\s*([^|]+)/i)
        || descricao.match(/((?:MINI[- ]?BOREAL|BOREAL|INCOLOR|REFLETIVO|LAMINADO|TEMPERADO)[^|]*?\b\d{1,2}\s*MM\b[^|]*)/i)
      const matchCor = descricao.match(/\bPINTURA\s+[A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ][A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ\s.-]*/i)
      const largura = Number(it.largura_mm || 0)
      const altura = Number(it.altura_mm || 0)
      const descricaoFinal = largura > 0 && altura > 0
        ? descricao
        : [descricao, 'MEDIDAS NÃO INFORMADAS NO PDF'].filter(Boolean).join(' | ')

      return {
        ambiente: it.ambiente?.trim() || null,
        tipo_esquadria: it.tipo_esquadria || inferirTipoEsquadria(descricao),
        tipo_outro_texto: it.tipo_outro_texto || null,
        descricao: descricaoFinal,
        quantidade: Math.max(1, Number(it.quantidade || 1)),
        largura_mm: largura,
        altura_mm: altura,
        cor: it.cor || matchCor?.[0]?.trim() || null,
        linha: matchLinha?.[1]?.trim() || null,
        vidro: matchVidro?.[1]?.trim() || null,
      }
    })
}

export function parseOrcamentoWVetroTexto(textoBruto: string): WVetroPdfResumo {
  const linhas = linhasNormalizadas(textoBruto)
  const porRotulos = extrairItensPorRotulos(linhas)
  const fallback = porRotulos.length > 0 ? [] : converterFallback(parseItensDoTextoPdf(textoBruto))
  const itens = porRotulos.length > 0 ? porRotulos : fallback
  const cidadeUf = extrairCidadeUf(linhas)

  return {
    parece_wvetro:
      /w\.?vetro/i.test(textoBruto)
      || linhas.some(l => /^\*?LOCAL\s*\/\s*AMBIENTE\s*:/i.test(l))
      || linhas.some(l => /^L\.\s+/i.test(l)),
    numero_orcamento: extrairNumeroOrcamento(linhas),
    cliente_nome: extrairCliente(linhas),
    cidade: cidadeUf.cidade,
    uf: cidadeUf.uf,
    valor_total: extrairTotal(linhas),
    itens,
  }
}
