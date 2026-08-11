import { ItemEsquadria, TipoEsquadria } from './tipos'

/**
 * Interpreta o texto bruto extraido de PDFs de orçamento da Esquadrifácio.
 *
 * O W.Vetro pode alterar a ordem textual de TIPO/ITEM durante a extração do
 * PDF. Por isso o parser usa *LOCAL/AMBIENTE como marcador principal do item
 * e mantém o formato antigo TIPO -> ITEM apenas como primeira tentativa.
 */
export function parseItensDoTextoPdf(textoBruto: string): Partial<ItemEsquadria>[] {
  if (!textoBruto) return []

  const linhas = textoBruto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0)

  let blocos = localizarBlocosPorTipoItem(linhas)

  // Fallback robusto para PDFs reais do W.Vetro: a posição de TIPO e ITEM
  // varia, mas cada peça possui *LOCAL/AMBIENTE e depois *COR PERFIL.
  if (blocos.length === 0) {
    blocos = localizarBlocosPorAmbiente(linhas)
  }

  // Segundo fallback para propostas geradas pelo próprio Atlas/Esquadrifácio,
  // no formato "ITEM 01", "ITEM 02", etc.
  if (blocos.length === 0) {
    blocos = localizarBlocosPorItemNumerado(linhas)
  }

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

function localizarBlocosPorTipoItem(linhas: string[]): string[][] {
  const inicios: number[] = []

  for (let i = 0; i < linhas.length; i++) {
    if (!/^TIPO\s*:/i.test(linhas[i])) continue

    // Alguns PDFs colocam numero/valor entre TIPO e ITEM, então usamos uma
    // janela maior que a implementação anterior.
    for (let j = i + 1; j < Math.min(i + 8, linhas.length); j++) {
      if (/^ITEM(?:\s+\d+)?$/i.test(linhas[j])) {
        inicios.push(i)
        break
      }
    }
  }

  return criarBlocos(linhas, inicios)
}

function localizarBlocosPorAmbiente(linhas: string[]): string[][] {
  const ambientes: number[] = []

  for (let i = 0; i < linhas.length; i++) {
    if (/^\*?LOCAL\s*\/\s*AMBIENTE\s*:/i.test(linhas[i])) ambientes.push(i)
  }

  if (ambientes.length === 0) return []

  return ambientes.map((idx, pos) => {
    // Inclui algumas linhas anteriores para capturar TIPO, ITEM e valores.
    const inicio = Math.max(0, idx - 6)
    const proximoAmbiente = pos + 1 < ambientes.length ? ambientes[pos + 1] : linhas.length

    // Evita trazer o cabeçalho do item seguinte. O bloco termina pouco antes
    // do próximo *LOCAL/AMBIENTE.
    const fim = pos + 1 < ambientes.length ? Math.max(idx + 1, proximoAmbiente - 1) : linhas.length
    return linhas.slice(inicio, fim)
  })
}

function localizarBlocosPorItemNumerado(linhas: string[]): string[][] {
  const inicios: number[] = []
  for (let i = 0; i < linhas.length; i++) {
    if (/^ITEM\s+\d+$/i.test(linhas[i])) inicios.push(i)
  }
  return criarBlocos(linhas, inicios)
}

function criarBlocos(linhas: string[], inicios: number[]): string[][] {
  return inicios.map((inicio, idx) => {
    const fim = idx + 1 < inicios.length ? inicios[idx + 1] : linhas.length
    return linhas.slice(inicio, fim)
  })
}

function interpretarBlocoItem(bloco: string[], indice: number): Partial<ItemEsquadria> | null {
  const ambienteLinha = bloco.find((l) => /^\*?LOCAL\s*\/\s*AMBIENTE\s*:/i.test(l))
  const ambiente = ambienteLinha
    ? ambienteLinha.replace(/^\*?LOCAL\s*\/\s*AMBIENTE\s*:/i, '').trim() || undefined
    : extrairAmbienteFormatoAtlas(bloco)

  const descricao = extrairDescricao(bloco, ambiente, indice)
  if (!descricao && !ambiente) return null

  const medidas = extrairQuantidadeEMedidas(bloco)
  const tipo_esquadria = inferirTipoEsquadria(descricao || '')

  const item: Partial<ItemEsquadria> = {
    ambiente,
    tipo_esquadria,
    descricao: descricao || ambiente || `Item ${indice + 1}`,
    quantidade: medidas.quantidade,
  }

  if (tipo_esquadria === 'outro' && descricao) {
    item.tipo_outro_texto = primeiraLinhaProduto(descricao)
  }
  if (medidas.largura_mm) item.largura_mm = medidas.largura_mm
  if (medidas.altura_mm) item.altura_mm = medidas.altura_mm

  return item
}

function extrairDescricao(bloco: string[], ambiente: string | undefined, indice: number): string {
  const idxCorPerfil = bloco.findIndex((l) => /^\*COR\s+PERFIL\s*:/i.test(l))
  const idxCorAcessorio = bloco.findIndex((l) => /^\*COR\s+ACESS[OÓ]RIO\s*:/i.test(l))

  if (idxCorPerfil !== -1 && idxCorAcessorio !== -1 && idxCorAcessorio > idxCorPerfil) {
    const partes = bloco
      .slice(idxCorPerfil + 1, idxCorAcessorio)
      .filter((l) => {
        if (!l) return false
        if (/^LINHA\s*:/i.test(l)) return false
        if (/^L\.\s+/i.test(l)) return false
        return true
      })

    if (partes.length > 0) return partes.join(' | ')
  }

  // Formato de proposta Atlas/Esquadrifácio: ITEM 01 + nome + especificação +
  // AMBIENTE MEDIDAS COR VIDRO.
  const idxItem = bloco.findIndex((l) => /^ITEM\s+\d+$/i.test(l))
  const idxCabecalho = bloco.findIndex((l) => /^AMBIENTE\s+MEDIDAS\s+COR\s+VIDRO/i.test(l))
  if (idxItem !== -1 && idxCabecalho > idxItem) {
    const partes = bloco.slice(idxItem + 1, idxCabecalho).filter(Boolean)
    if (partes.length > 0) return partes.join(' | ')
  }

  return ambiente || `Item ${indice + 1}`
}

function extrairQuantidadeEMedidas(bloco: string[]): {
  quantidade: number
  largura_mm?: number
  altura_mm?: number
} {
  const idxQtdeLabel = bloco.findIndex((l) => /^QTDE\.?\s+/i.test(l) || /^QTDE\.$/i.test(l))

  if (idxQtdeLabel !== -1) {
    // O W.Vetro normalmente coloca "1 2500 2100" na linha seguinte, mas em
    // alguns PDFs os números podem pular uma linha.
    for (let i = idxQtdeLabel + 1; i < Math.min(idxQtdeLabel + 5, bloco.length); i++) {
      const numeros = bloco[i].match(/\d+(?:[.,]\d+)?/g)
      if (!numeros || numeros.length < 3) continue

      const quantidade = parseInt(numeros[0].replace(/\D/g, ''), 10) || 1
      const largura_mm = numeroMedida(numeros[1])
      const altura_mm = numeroMedida(numeros[2])
      if (largura_mm && altura_mm) return { quantidade, largura_mm, altura_mm }
    }
  }

  // Formato Atlas: procura "2.500 x 2.100 mm" e assume quantidade 1.
  const texto = bloco.join(' ')
  const matchMedidas = texto.match(/(\d{2,5}(?:[.,]\d{3})?)\s*[xX×]\s*(\d{2,5}(?:[.,]\d{3})?)\s*(?:mm)?/i)
  if (matchMedidas) {
    return {
      quantidade: 1,
      largura_mm: numeroMedida(matchMedidas[1]),
      altura_mm: numeroMedida(matchMedidas[2]),
    }
  }

  return { quantidade: 1 }
}

function numeroMedida(valor: string): number | undefined {
  if (!valor) return undefined

  // Medidas W.Vetro costumam vir como 2500; propostas Atlas podem usar 2.500.
  const normalizado = /^\d{1,3}\.\d{3}$/.test(valor)
    ? valor.replace('.', '')
    : valor.replace(',', '.')
  const numero = Number(normalizado)
  return Number.isFinite(numero) && numero > 0 ? numero : undefined
}

function extrairAmbienteFormatoAtlas(bloco: string[]): string | undefined {
  const idxCabecalho = bloco.findIndex((l) => /^AMBIENTE\s+MEDIDAS\s+COR\s+VIDRO/i.test(l))
  if (idxCabecalho === -1) return undefined

  const linha = bloco[idxCabecalho + 1]
  if (!linha) return undefined

  const posMedida = linha.search(/\d{2,5}(?:[.,]\d{3})?\s*[xX×]/)
  if (posMedida <= 0) return undefined
  return linha.slice(0, posMedida).trim() || undefined
}

function primeiraLinhaProduto(descricao: string): string {
  const partes = descricao.split('|').map((p) => p.trim()).filter(Boolean)
  const produto = partes.find((p) => /(PORTA|JANELA|VITR|MAXIM|TELA|FACHADA|BOX|GUARDA|LAMBRI)/i.test(p))
  return produto || partes[0] || descricao
}

/**
 * Tenta inferir o tipo de esquadria usado pelo checklist/desenho a partir da
 * descrição comercial extraída do PDF.
 */
export function inferirTipoEsquadria(descricao: string): TipoEsquadria {
  const d = (descricao || '').toUpperCase()

  if (d.includes('MAXIM-AR') || d.includes('MAXIMAR') || d.includes('MAXIM AR')) return 'janela_maximiar'
  if (d.includes('BASCULANTE')) return 'janela_basculante'
  if (d.includes('VITR')) return 'vitro'
  if (d.includes('FACHADA')) return 'fachada'
  if (d.includes('BOX')) return 'box'

  const temPorta = d.includes('PORTA')
  if (temPorta && d.includes('CORRER')) return 'porta_correr'
  if (temPorta && d.includes('PIVOT')) return 'porta_pivotante'
  if (temPorta) return 'porta_abrir'

  if (d.includes('JANELA') && d.includes('CORRER')) return 'janela_correr'
  if (d.includes('CORRER')) return 'janela_correr'

  return 'outro'
}
