import { ItemEsquadria, TipoEsquadria } from './tipos'

/**
 * Interpreta o texto bruto extraido de um PDF de orcamento (padrao w.vetro /
 * Esquadrifacio) e devolve uma lista de itens (esquadrias) para popular o
 * orcamento automaticamente.
 *
 * Importante: a extracao de texto de PDF nao segue necessariamente a ordem
 * visual do layout (colunas lado a lado podem sair intercaladas). Este parser
 * foi construido a partir de uma amostra real e pode precisar de ajustes
 * para outros modelos de orcamento.
 */
export function parseItensDoTextoPdf(textoBruto: string): Partial<ItemEsquadria>[] {
  const itens: Partial<ItemEsquadria>[] = []
  if (!textoBruto) return itens

  const linhas = textoBruto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const iniciosBloco: number[] = []
  for (let i = 0; i < linhas.length; i++) {
    if (/^TIPO:/i.test(linhas[i])) {
      for (let j = i + 1; j < Math.min(i + 4, linhas.length); j++) {
        if (/^ITEM$/i.test(linhas[j])) {
          iniciosBloco.push(i)
          break
        }
      }
    }
  }

  for (let b = 0; b < iniciosBloco.length; b++) {
    const inicio = iniciosBloco[b]
    const fim = b + 1 < iniciosBloco.length ? iniciosBloco[b + 1] : linhas.length
    const bloco = linhas.slice(inicio, fim)

    try {
      const item = interpretarBlocoItem(bloco, b)
      if (item) itens.push(item)
    } catch (e) {
      console.error('Erro ao interpretar item do PDF (bloco ignorado):', e)
    }
  }

  return itens
}

function interpretarBlocoItem(bloco: string[], indice: number): Partial<ItemEsquadria> | null {
  const ambienteLinha = bloco.find((l) => /^\*LOCAL\/AMBIENTE:/i.test(l))
  const ambiente = ambienteLinha ? ambienteLinha.replace(/^\*LOCAL\/AMBIENTE:/i, '').trim() : undefined

  const idxCorPerfil = bloco.findIndex((l) => /^\*COR PERFIL:/i.test(l))
  const idxCorAcessorio = bloco.findIndex((l) => /^\*COR ACESS[OÓ]RIO:/i.test(l))
  let linhasDescritivas: string[] = []
  if (idxCorPerfil !== -1 && idxCorAcessorio !== -1 && idxCorAcessorio > idxCorPerfil) {
    linhasDescritivas = bloco.slice(idxCorPerfil + 1, idxCorAcessorio)
  }

  const descricaoPartes = linhasDescritivas.filter((l) => l && !/^LINHA:/i.test(l))
  const descricao = descricaoPartes.length > 0 ? descricaoPartes.join(' | ') : ambiente || ('Item ' + (indice + 1))

  const idxQtdeLabel = bloco.findIndex((l) => /^QTDE\./i.test(l))
  let quantidade = 1
  let largura_mm: number | undefined
  let altura_mm: number | undefined
  if (idxQtdeLabel !== -1 && bloco[idxQtdeLabel + 1]) {
    const numeros = bloco[idxQtdeLabel + 1].match(/[\d.,]+/g)
    if (numeros && numeros.length >= 1) quantidade = parseInt(numeros[0], 10) || 1
    if (numeros && numeros.length >= 2) largura_mm = parseFloat(numeros[1].replace(',', '.'))
    if (numeros && numeros.length >= 3) altura_mm = parseFloat(numeros[2].replace(',', '.'))
  }

  const tipo_esquadria = inferirTipoEsquadria(descricao)

  const item: Partial<ItemEsquadria> = {
    ambiente,
    tipo_esquadria,
    descricao,
    quantidade,
  }
  if (largura_mm) item.largura_mm = largura_mm
  if (altura_mm) item.altura_mm = altura_mm

  return item
}

/**
 * Tenta inferir o tipo de esquadria (usado para escolher o desenho/icone)
 * a partir do texto descritivo do item.
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

  if (d.includes('CORRER')) return 'janela_correr'

  return 'outro'
}
