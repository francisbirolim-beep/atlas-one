import { ItemEsquadria, TipoEsquadria } from './tipos'

export function parseItensDoTextoPdf(textoBruto: string): Partial<ItemEsquadria>[] {
  if (!textoBruto) return []

  const linhas = textoBruto
    .split(/\r?\n/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  // O pdf-parse do W.Vetro devolve os valores antes dos respectivos rótulos.
  // Ex.: AMBIENTE, COR ACESSÓRIO, COR VIDRO, COR ESQUADRIA, DESCRIÇÃO,
  // MEDIDAS, Nº ITEM, TIPO, LINHA e só depois os rótulos *LOCAL/AMBIENTE etc.
  // Por isso este parser específico deve rodar antes dos fallbacks genéricos.
  if (linhas.some(l => /w\.vetro/i.test(l)) && linhas.some(l => /^\*?LOCAL\s*\/\s*AMBIENTE\s*:/i.test(l))) {
    const wvetro = parseItensWVetro(linhas)
    if (wvetro.length > 0) return wvetro
  }

  let blocos = localizarBlocosPorTipoItem(linhas)
  if (blocos.length === 0) blocos = localizarBlocosPorAmbiente(linhas)
  if (blocos.length === 0) blocos = localizarBlocosPorItemNumerado(linhas)

  const itens: Partial<ItemEsquadria>[] = []
  for (let i = 0; i < blocos.length; i++) {
    try {
      const item = interpretarBlocoItem(blocos[i], i)
      if (item) itens.push(item)
    } catch (e) {
      console.error('Erro ao interpretar item do PDF (bloco ignorado):', e)
    }
  }
  return itens
}

function parseItensWVetro(linhas: string[]): Partial<ItemEsquadria>[] {
  const marcadores = linhas
    .map((linha, i) => /^\*?LOCAL\s*\/\s*AMBIENTE\s*:/i.test(linha) ? i : -1)
    .filter(i => i >= 0)

  const itens: Partial<ItemEsquadria>[] = []
  let fimAnterior = -1

  for (let pos = 0; pos < marcadores.length; pos++) {
    const idxLocal = marcadores[pos]
    const idxLinhaRotulo = acharAFrente(linhas, idxLocal, /^\*LINHA\s*:/i, 12)
    if (idxLinhaRotulo < 0) continue

    const inicio = fimAnterior >= 0 ? fimAnterior + 1 : Math.max(0, idxLocal - 24)
    const valores = linhas.slice(inicio, idxLocal)
    fimAnterior = idxLinhaRotulo

    const idxLinhaValor = acharUltimo(valores, /^L\.\s+/i)
    const idxTipoValor = idxLinhaValor > 0 ? acharUltimoAte(valores, idxLinhaValor - 1, /^[A-Z]{1,4}$/i) : -1
    const idxItemValor = idxTipoValor > 0 ? acharUltimoAte(valores, idxTipoValor - 1, /^\d{1,3}$/) : -1
    const idxMedidas = idxItemValor > 0 ? acharUltimoAte(valores, idxItemValor - 1, /^\d+(?:[.,]\d+)?\s+\d+(?:[.,]\d+)?\s+\d+(?:[.,]\d+)?(?:\s+.*)?$/) : -1

    if (idxLinhaValor < 0 || idxTipoValor < 0 || idxItemValor < 0 || idxMedidas < 0) continue

    const descStart = acharInicioDescricao(valores, idxMedidas)
    if (descStart < 0) continue

    const ambienteIdx = descStart - 4
    const acessorioIdx = descStart - 3
    const vidroIdx = descStart - 2
    const corIdx = descStart - 1
    if (ambienteIdx < 0) continue

    const ambiente = valores[ambienteIdx]
    const corAcessorio = valores[acessorioIdx]
    const vidro = valores[vidroIdx]
    const corEsquadria = valores[corIdx]
    const descricaoProduto = valores.slice(descStart, idxMedidas).join(' ')
    const linha = valores[idxLinhaValor].replace(/^L\.\s*/i, '').trim()
    const tipoCodigo = valores[idxTipoValor]
    const numeros = valores[idxMedidas].match(/\d+(?:[.,]\d+)?/g) || []
    if (numeros.length < 3) continue

    const quantidade = parseInt(numeros[0].replace(/\D/g, ''), 10) || 1
    const largura_mm = numeroMedida(numeros[1])
    const altura_mm = numeroMedida(numeros[2])
    if (!largura_mm || !altura_mm) continue

    const descricao = [
      descricaoProduto,
      linha ? `LINHA: ${linha}` : '',
      vidro ? `VIDRO: ${vidro}` : '',
      corAcessorio ? `ACESSÓRIO: ${corAcessorio}` : '',
      tipoCodigo ? `CÓDIGO W.VETRO: ${tipoCodigo}` : '',
    ].filter(Boolean).join(' | ')

    const tipo_esquadria = inferirTipoEsquadria(descricaoProduto)
    const item: Partial<ItemEsquadria> = {
      ambiente,
      tipo_esquadria,
      descricao,
      quantidade,
      largura_mm,
      altura_mm,
      cor: corEsquadria || undefined,
    }
    if (tipo_esquadria === 'outro') item.tipo_outro_texto = primeiraLinhaProduto(descricaoProduto)
    itens.push(item)
  }

  return itens
}

function acharAFrente(linhas: string[], inicio: number, rx: RegExp, limite: number) {
  for (let i = inicio; i < Math.min(linhas.length, inicio + limite); i++) if (rx.test(linhas[i])) return i
  return -1
}

function acharUltimo(linhas: string[], rx: RegExp) {
  return acharUltimoAte(linhas, linhas.length - 1, rx)
}

function acharUltimoAte(linhas: string[], fim: number, rx: RegExp) {
  for (let i = fim; i >= 0; i--) if (rx.test(linhas[i])) return i
  return -1
}

function acharInicioDescricao(valores: string[], idxMedidas: number) {
  const rxProduto = /(PORTA|JANELA|MAXIM|PORTINHOLA|FACHADA|PAINEL|REVESTIMENTO|VITR|BOX|GUARDA|LAMBRI)/i
  for (let i = idxMedidas - 1; i >= Math.max(0, idxMedidas - 8); i--) {
    if (rxProduto.test(valores[i])) return i
  }
  return -1
}

function localizarBlocosPorTipoItem(linhas: string[]): string[][] {
  const inicios: number[] = []
  for (let i = 0; i < linhas.length; i++) {
    if (!/^TIPO\s*:/i.test(linhas[i])) continue
    for (let j = i + 1; j < Math.min(i + 8, linhas.length); j++) {
      if (/^ITEM(?:\s+\d+)?$/i.test(linhas[j])) { inicios.push(i); break }
    }
  }
  return criarBlocos(linhas, inicios)
}

function localizarBlocosPorAmbiente(linhas: string[]): string[][] {
  const ambientes: number[] = []
  for (let i = 0; i < linhas.length; i++) if (/^\*?LOCAL\s*\/\s*AMBIENTE\s*:/i.test(linhas[i])) ambientes.push(i)
  return ambientes.map((idx, pos) => {
    const inicio = Math.max(0, idx - 12)
    const proximo = pos + 1 < ambientes.length ? ambientes[pos + 1] : linhas.length
    return linhas.slice(inicio, proximo)
  })
}

function localizarBlocosPorItemNumerado(linhas: string[]): string[][] {
  const inicios: number[] = []
  for (let i = 0; i < linhas.length; i++) if (/^ITEM\s+\d+$/i.test(linhas[i])) inicios.push(i)
  return criarBlocos(linhas, inicios)
}

function criarBlocos(linhas: string[], inicios: number[]): string[][] {
  return inicios.map((inicio, idx) => linhas.slice(inicio, idx + 1 < inicios.length ? inicios[idx + 1] : linhas.length))
}

function interpretarBlocoItem(bloco: string[], indice: number): Partial<ItemEsquadria> | null {
  const ambienteLinha = bloco.find(l => /^\*?LOCAL\s*\/\s*AMBIENTE\s*:/i.test(l))
  const ambiente = ambienteLinha
    ? ambienteLinha.replace(/^\*?LOCAL\s*\/\s*AMBIENTE\s*:/i, '').trim() || undefined
    : extrairAmbienteFormatoAtlas(bloco)
  const descricao = extrairDescricao(bloco, ambiente, indice)
  if (!descricao && !ambiente) return null
  const medidas = extrairQuantidadeEMedidas(bloco)
  const tipo_esquadria = inferirTipoEsquadria(descricao || '')
  const item: Partial<ItemEsquadria> = { ambiente, tipo_esquadria, descricao: descricao || ambiente || `Item ${indice + 1}`, quantidade: medidas.quantidade }
  if (tipo_esquadria === 'outro' && descricao) item.tipo_outro_texto = primeiraLinhaProduto(descricao)
  if (medidas.largura_mm) item.largura_mm = medidas.largura_mm
  if (medidas.altura_mm) item.altura_mm = medidas.altura_mm
  return item
}

function extrairDescricao(bloco: string[], ambiente: string | undefined, indice: number): string {
  const idxCor = bloco.findIndex(l => /^\*COR\s+(?:PERFIL|ESQUADRIA)\s*:/i.test(l))
  const idxAcessorio = bloco.findIndex(l => /^\*COR\s+ACESS[OÓ]RIO\s*:/i.test(l))
  if (idxCor !== -1 && idxAcessorio !== -1 && idxAcessorio > idxCor) {
    const partes = bloco.slice(idxCor + 1, idxAcessorio).filter(l => l && !/^LINHA\s*:/i.test(l) && !/^L\.\s+/i.test(l))
    if (partes.length > 0) return partes.join(' | ')
  }
  const idxItem = bloco.findIndex(l => /^ITEM\s+\d+$/i.test(l))
  const idxCab = bloco.findIndex(l => /^AMBIENTE\s+MEDIDAS\s+COR\s+VIDRO/i.test(l))
  if (idxItem !== -1 && idxCab > idxItem) {
    const partes = bloco.slice(idxItem + 1, idxCab).filter(Boolean)
    if (partes.length > 0) return partes.join(' | ')
  }
  return ambiente || `Item ${indice + 1}`
}

function extrairQuantidadeEMedidas(bloco: string[]): { quantidade: number; largura_mm?: number; altura_mm?: number } {
  const idxQtde = bloco.findIndex(l => /^QTDE\.?\s+/i.test(l) || /^QTDE\.$/i.test(l))
  if (idxQtde !== -1) {
    for (let i = idxQtde + 1; i < Math.min(idxQtde + 5, bloco.length); i++) {
      const numeros = bloco[i].match(/\d+(?:[.,]\d+)?/g)
      if (!numeros || numeros.length < 3) continue
      const quantidade = parseInt(numeros[0].replace(/\D/g, ''), 10) || 1
      const largura_mm = numeroMedida(numeros[1])
      const altura_mm = numeroMedida(numeros[2])
      if (largura_mm && altura_mm) return { quantidade, largura_mm, altura_mm }
    }
  }
  const texto = bloco.join(' ')
  const m = texto.match(/(\d{2,5}(?:[.,]\d{3})?)\s*[xX×]\s*(\d{2,5}(?:[.,]\d{3})?)\s*(?:mm)?/i)
  return m ? { quantidade: 1, largura_mm: numeroMedida(m[1]), altura_mm: numeroMedida(m[2]) } : { quantidade: 1 }
}

function numeroMedida(valor: string): number | undefined {
  if (!valor) return undefined
  const normalizado = /^\d{1,3}\.\d{3}$/.test(valor) ? valor.replace('.', '') : valor.replace(',', '.')
  const numero = Number(normalizado)
  return Number.isFinite(numero) && numero > 0 ? numero : undefined
}

function extrairAmbienteFormatoAtlas(bloco: string[]): string | undefined {
  const idx = bloco.findIndex(l => /^AMBIENTE\s+MEDIDAS\s+COR\s+VIDRO/i.test(l))
  if (idx === -1 || !bloco[idx + 1]) return undefined
  const linha = bloco[idx + 1]
  const pos = linha.search(/\d{2,5}(?:[.,]\d{3})?\s*[xX×]/)
  return pos > 0 ? linha.slice(0, pos).trim() || undefined : undefined
}

function primeiraLinhaProduto(descricao: string): string {
  const partes = descricao.split('|').map(p => p.trim()).filter(Boolean)
  const produto = partes.find(p => /(PORTA|JANELA|VITR|MAXIM|TELA|FACHADA|BOX|GUARDA|LAMBRI|PORTINHOLA)/i.test(p))
  return produto || partes[0] || descricao
}

export function inferirTipoEsquadria(descricao: string): TipoEsquadria {
  const d = (descricao || '').toUpperCase()
  if (d.includes('MAXIM-AR') || d.includes('MAXIMAR') || d.includes('MAXIM AR')) return 'janela_maximiar'
  if (d.includes('BASCULANTE')) return 'janela_basculante'
  if (d.includes('VITR')) return 'vitro'
  if (d.includes('FACHADA')) return 'fachada'
  if (d.includes('BOX')) return 'box'
  const temPorta = d.includes('PORTA') || d.includes('PORTINHOLA')
  if (temPorta && d.includes('CORRER')) return 'porta_correr'
  if (temPorta && d.includes('PIVOT')) return 'porta_pivotante'
  if (temPorta) return 'porta_abrir'
  if (d.includes('JANELA') && d.includes('CORRER')) return 'janela_correr'
  if (d.includes('CORRER')) return 'janela_correr'
  return 'outro'
}
