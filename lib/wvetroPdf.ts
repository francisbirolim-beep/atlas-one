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

function linhaPareceDadoCliente(valor: string) {
  if (!valor || valor.length < 2 || valor.length > 90) return false
  if (/^(CLIENTE|TEL|EMAIL|CNPJ|CPF|ENDERE[ÇC]O|CEP|IE\/RG|TEL2|FAX|DATA|TIPO|ITEM|OR[ÇC]AMENTO)\b/i.test(valor)) return false
  if (/^\d+(?:[.,]\d+)?$/.test(valor)) return false
  if (/^,?\s*S\/?N\s*$/i.test(valor)) return false
  if (/\bCEP\s*:/i.test(valor)) return false
  if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(valor)) return false
  if (/^R?\$?\s*\d[\d.,]*$/.test(valor)) return false
  if (/WVETRO|W\.VETRO|SISTEMA PARA VIDRA/i.test(valor)) return false
  return /[A-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇ]{2,}/i.test(valor)
}

function extrairCliente(linhas: string[]) {
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    if (!linha) continue

    const inline = linha.match(/^CLIENTE\s*:\s*(.+)$/i)
    if (inline?.[1] && !/TEL\.?\s*FIXO|CELULAR/i.test(inline[1])) {
      return inline[1].trim()
    }

    if (/^CLIENTE\s*:/i.test(linha)) {
      for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
        const candidato = linhas[j] || ''
        if (linhaPareceDadoCliente(candidato)) return candidato
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

function extrairItensPorRotulos(linhas: string[]): WVetroPdfItem[] {
  const locais = linhas
    .map((linha, index) => /^\*?LOCAL\s*\/\s*AMBIENTE\s*:/i.test(linha) ? index : -1)
    .filter(index => index >= 0)

  const itens: WVetroPdfItem[] = []

  for (let pos = 0; pos < locais.length; pos++) {
    const idxLocal = locais[pos] ?? -1
    if (idxLocal < 0) continue
    const proximoLocal = pos + 1 < locais.length ? (locais[pos + 1] ?? linhas.length) : linhas.length
    const fim = Math.min(proximoLocal, idxLocal + 28)
    const bloco = linhas.slice(idxLocal, fim)

    const medidas = extrairQtdMedidas(bloco)
    if (!medidas) continue

    const localLinha = linhas[idxLocal] || ''
    const ambienteInline = limparValorRotulo(localLinha, /^\*?LOCAL\s*\/\s*AMBIENTE\s*:\s*(.*)$/i)
    const ambiente = ambienteInline || candidatoAmbienteAntesDoRotulo(linhas, idxLocal)

    const produto = bloco.find(l => /^(PORTA|JANELA|MAXIM|FACHADA|PAINEL|REVESTIMENTO|VITR|BOX|GUARDA|LAMBRI|PORTINHOLA)/i.test(l)) || ''
    if (!produto) continue

    const linhaValor = bloco.find(l => /^L\.\s+/i.test(l)) || ''
    const linha = linhaValor.replace(/^L\.\s*/i, '').trim()
      || (produto.includes('|') ? produto.split('|').pop()?.trim() || '' : '')

    const corPerfilLinha = bloco.find(l => /^\*COR\s+(?:PERFIL|ESQUADRIA)\s*:/i.test(l)) || ''
    const corPerfil = limparValorRotulo(corPerfilLinha, /^\*COR\s+(?:PERFIL|ESQUADRIA)\s*:\s*(.*)$/i)

    const vidro = bloco.find(l =>
      /(?:TEMPERADO|LAMINADO|INCOLOR|REFLETIVO|BOREAL|MINIBOREL|VIDRO)/i.test(l)
      && /\b\d{1,2}\s*MM\b/i.test(l)
    ) || ''

    const tipo = inferirTipoEsquadria(produto)
    const descricao = [
      produto,
      linha ? `LINHA: ${linha}` : '',
      vidro ? `VIDRO: ${vidro}` : '',
      corPerfil ? `COR PERFIL: ${corPerfil}` : '',
    ].filter(Boolean).join(' | ')

    itens.push({
      ambiente: ambiente || null,
      tipo_esquadria: tipo,
      tipo_outro_texto: tipo === 'outro' ? produto : null,
      descricao,
      quantidade: medidas.quantidade,
      largura_mm: medidas.largura,
      altura_mm: medidas.altura,
      cor: corPerfil || null,
      linha: linha || null,
      vidro: vidro || null,
    })
  }

  return itens
}

function converterFallback(itens: Partial<ItemEsquadria>[]): WVetroPdfItem[] {
  return itens
    .filter(it => {
      const largura = Number(it.largura_mm || 0)
      const altura = Number(it.altura_mm || 0)
      return !!(it.descricao || it.tipo_outro_texto) && largura > 0 && altura > 0
    })
    .map(it => {
      const descricao = (it.descricao || it.tipo_outro_texto || '').trim()
      const matchLinha = descricao.match(/(?:^|\|)\s*LINHA\s*:\s*([^|]+)/i)
      const matchVidro = descricao.match(/(?:^|\|)\s*VIDRO\s*:\s*([^|]+)/i)
      return {
        ambiente: it.ambiente?.trim() || null,
        tipo_esquadria: it.tipo_esquadria || inferirTipoEsquadria(descricao),
        tipo_outro_texto: it.tipo_outro_texto || null,
        descricao,
        quantidade: Math.max(1, Number(it.quantidade || 1)),
        largura_mm: Number(it.largura_mm),
        altura_mm: Number(it.altura_mm),
        cor: it.cor || null,
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
