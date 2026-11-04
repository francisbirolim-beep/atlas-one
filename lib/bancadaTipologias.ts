import { calcularFormulasCorte, type FolgasEncaixe, type OpcoesEscolhidas, type PecaFormula, type ResultadoPeca, type TipologiaFormulasCorte } from './formulasCorteEngine'

export type CorteReferencia = {
  codigo: string
  eixo?: 'L' | 'H'
  comprimento_mm: number
  quantidade: number
}

export type CasoTipologia = {
  nome: string
  largura_mm: number
  altura_mm: number
  opcoes: OpcoesEscolhidas
  folgas: FolgasEncaixe
  cortes: CorteReferencia[]
}

export type DesvioCorte = {
  codigo: string
  eixo?: 'L' | 'H'
  esperado_mm: number | null
  calculado_mm: number | null
  esperado_quantidade: number | null
  calculado_quantidade: number | null
  diferenca_mm: number | null
  estado: 'conforme' | 'divergente' | 'ausente_no_atlas' | 'ausente_na_referencia'
}

export type ResultadoConferenciaTipologia = {
  ok: boolean
  avaliados: number
  conformes: number
  desvios: DesvioCorte[]
  resultados: ResultadoPeca[]
  erro?: string
}

export function normalizarCodigo(codigo: string): string {
  return String(codigo || '').trim().toUpperCase().replace(/\s+/g, '')
}

export function listaCortesTexto(texto: string): CorteReferencia[] {
  const linhas = texto.split(/\r?\n/).map(x => x.trim()).filter(Boolean)
  if (linhas.length > 500) throw new Error('Limite de 500 linhas por projeto.')
  const result: CorteReferencia[] = []
  for (const [index, linha] of linhas.entries()) {
    if (/^(c[oó]digo|perfil)[;\t]/i.test(linha)) continue
    const colunas = linha.split(/[;\t]/).map(x => x.trim())
    if (colunas.length < 3 || colunas.length > 4) {
      throw new Error(`Linha ${index + 1}: use CÓDIGO;EIXO;COMPRIMENTO;QUANTIDADE (ou omita o eixo).`)
    }
    const [codigo, ...resto] = colunas
    const temEixo = resto[0] === '' || /^(L|H)$/i.test(resto[0])
    const eixo = temEixo && resto[0] ? (resto[0].toUpperCase() as 'L' | 'H') : undefined
    const dados = temEixo ? resto.slice(1) : resto
    if (dados.length < 2) throw new Error(`Linha ${index + 1}: informe comprimento e quantidade.`)
    const numero = (v: string) => Number(v.replace(/\s*mm\s*$/i, '').replace(',', '.'))
    const comprimento_mm = numero(dados[0])
    const quantidade = numero(dados[1])
    if (!/^[A-ZÀ-ÿ0-9][A-ZÀ-ÿ0-9_.-]{0,39}$/i.test(codigo) ||
        !Number.isFinite(comprimento_mm) || comprimento_mm <= 0 || comprimento_mm > 20000 ||
        !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 10000) {
      throw new Error(`Linha ${index + 1}: código, comprimento ou quantidade inválidos.`)
    }
    result.push({ codigo: normalizarCodigo(codigo), eixo, comprimento_mm, quantidade })
  }
  if (result.length === 0) throw new Error('Informe ao menos uma peça de corte conferida.')
  return result
}

function agruparCortes(cortes: CorteReferencia[]) {
  return cortes
    .map(c => ({ ...c, codigo: normalizarCodigo(c.codigo) }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo) || (a.eixo || '').localeCompare(b.eixo || '') || a.comprimento_mm - b.comprimento_mm)
}

export function conferirCaso(
  definicao: TipologiaFormulasCorte,
  caso: CasoTipologia,
  tolerancia_mm = 0.5,
): ResultadoConferenciaTipologia {
  try {
    if (!Number.isFinite(tolerancia_mm) || tolerancia_mm < 0 || tolerancia_mm > 2) throw new Error('Tolerância inválida.')
    if (!Number.isFinite(caso.largura_mm) || caso.largura_mm <= 0 ||
        !Number.isFinite(caso.altura_mm) || caso.altura_mm <= 0) throw new Error('Medidas inválidas.')
    const folgas = caso.folgas
    const simulacao: TipologiaFormulasCorte = { ...definicao, folgas }
    const resultados = calcularFormulasCorte(simulacao, caso.largura_mm, caso.altura_mm, caso.opcoes)
    const calculados = agruparCortes(resultados.map(p => ({
      codigo: p.codigo,
      eixo: p.eixo,
      comprimento_mm: p.tamanho,
      quantidade: p.quantidade ?? 1,
    })))
    const esperados = agruparCortes(caso.cortes)
    const chave = (c: CorteReferencia) => c.codigo + '|' + (c.eixo || '')
    const grupos = new Set([...calculados, ...esperados].map(chave))
    const desvios: DesvioCorte[] = []
    for (const grupo of grupos) {
      const exp = esperados.filter(x => chave(x) === grupo)
      const calc = calculados.filter(x => chave(x) === grupo)
      // Ordenação por comprimento mantém os itens duplicados como peças separadas.
      for (let i = 0; i < Math.max(exp.length, calc.length); i++) {
        const a = exp[i], b = calc[i]
        const diferenca = a && b ? b.comprimento_mm - a.comprimento_mm : null
        const estado: DesvioCorte['estado'] = !a ? 'ausente_na_referencia'
          : !b ? 'ausente_no_atlas'
            : Math.abs(diferenca!) <= tolerancia_mm && a.quantidade === b.quantidade ? 'conforme' : 'divergente'
        desvios.push({
          codigo: a?.codigo || b.codigo,
          eixo: a?.eixo || b?.eixo,
          esperado_mm: a?.comprimento_mm ?? null,
          calculado_mm: b?.comprimento_mm ?? null,
          esperado_quantidade: a?.quantidade ?? null,
          calculado_quantidade: b?.quantidade ?? null,
          diferenca_mm: diferenca,
          estado,
        })
      }
    }
    const conformes = desvios.filter(x => x.estado === 'conforme').length
    return { ok: desvios.length > 0 && conformes === desvios.length, avaliados: desvios.length, conformes, desvios, resultados }
  } catch (e) {
    return { ok: false, avaliados: 0, conformes: 0, desvios: [], resultados: [], erro: e instanceof Error ? e.message : 'Não foi possível calcular.' }
  }
}

export function assinaturaTecnica(definicao: {
  tipologia_id: string
  pecas: PecaFormula[]
  variaveis: TipologiaFormulasCorte['variaveis']
  folgas?: FolgasEncaixe
}): string {
  // Assinatura determinística e comparável, para que revisões invalidem casos antigos.
  return JSON.stringify({
    tipologia_id: definicao.tipologia_id,
    pecas: definicao.pecas,
    variaveis: definicao.variaveis,
    folgas: definicao.folgas,
  })
}

export function compararSimulacoes(a: ResultadoPeca[], b: ResultadoPeca[]) {
  // Uma troca de código deve manter a peça no mesmo grupo e evidenciar o impacto.
  const mapa = (valores: ResultadoPeca[]) => {
    const contagens = new Map<string, number>()
    return new Map(valores.map(p => {
      const grupo = (p.grupo || p.codigo) + '|' + (p.eixo || '')
      const indice = contagens.get(grupo) || 0
      contagens.set(grupo, indice + 1)
      return [grupo + '|' + indice, p] as const
    }))
  }
  const base = mapa(a), alternativo = mapa(b)
  return Array.from(new Set([...base.keys(), ...alternativo.keys()])).map(chave => {
    const original = base.get(chave), trocado = alternativo.get(chave)
    return {
      codigo: original?.codigo || trocado?.codigo || '',
      codigo_alternativo: trocado?.codigo || '',
      descricao: trocado?.descricao || original?.descricao || '',
      original_mm: original?.tamanho ?? null,
      alternativo_mm: trocado?.tamanho ?? null,
      diferenca_mm: original && trocado ? trocado.tamanho - original.tamanho : null,
    }
  })
}
