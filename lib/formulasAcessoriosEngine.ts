import type { AcessorioFormulaCorte } from '@/lib/engenhariaFormulasCorte'

export type ResultadoAcessorioFormula = {
  index: number
  valor: number | null
  calculo: string
  erro?: string
}

type Token =
  | { tipo: 'numero'; valor: string }
  | { tipo: 'identificador'; valor: string }
  | { tipo: 'funcao'; valor: 'ROUND' | 'CEIL' }
  | { tipo: 'operador'; valor: '+' | '-' | '*' | '/' | '(' | ')' }

export class FormulaAcessorioError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FormulaAcessorioError'
  }
}

function tokenizar(formula: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < formula.length) {
    const restante = formula.slice(i)
    const espaco = restante.match(/^\s+/)
    if (espaco) { i += espaco[0].length; continue }
    const numero = restante.match(/^\d+(?:\.\d+)?/)
    if (numero) { tokens.push({ tipo: 'numero', valor: numero[0] }); i += numero[0].length; continue }
    const identificador = restante.match(/^[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*/)
    if (identificador) {
      const valor = identificador[0]
      if (valor === 'ROUND' || valor === 'CEIL') tokens.push({ tipo: 'funcao', valor })
      else tokens.push({ tipo: 'identificador', valor })
      i += valor.length
      continue
    }
    const char = formula[i]
    if ('+-*/()'.includes(char)) {
      tokens.push({ tipo: 'operador', valor: char as '+' | '-' | '*' | '/' | '(' | ')' })
      i += 1
      continue
    }
    throw new FormulaAcessorioError(`Caractere não permitido "${char}" em "${formula}"`)
  }
  if (!tokens.length) throw new FormulaAcessorioError('Fórmula vazia.')
  return tokens
}

function avaliar(formula: string, contexto: Record<string, number>): number {
  const tokens = tokenizar(formula)
  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]
  const operador = (valor: string) => peek()?.tipo === 'operador' && peek()?.valor === valor

  function expr(): number {
    let valor = termo()
    while (operador('+') || operador('-')) {
      const op = next() as Extract<Token, { tipo: 'operador' }>
      const rhs = termo()
      valor = op.valor === '+' ? valor + rhs : valor - rhs
    }
    return valor
  }
  function termo(): number {
    let valor = fator()
    while (operador('*') || operador('/')) {
      const op = next() as Extract<Token, { tipo: 'operador' }>
      const rhs = fator()
      if (op.valor === '/' && rhs === 0) throw new FormulaAcessorioError(`Divisão por zero em "${formula}"`)
      valor = op.valor === '*' ? valor * rhs : valor / rhs
    }
    return valor
  }
  function fator(): number {
    const token = peek()
    if (!token) throw new FormulaAcessorioError(`Fórmula incompleta: "${formula}"`)
    if (token.tipo === 'operador' && token.valor === '(') {
      next(); const valor = expr(); const fecha = next()
      if (fecha?.tipo !== 'operador' || fecha.valor !== ')') throw new FormulaAcessorioError(`Parênteses não fechados em "${formula}"`)
      return valor
    }
    if (token.tipo === 'operador' && (token.valor === '+' || token.valor === '-')) {
      next(); const valor = fator(); return token.valor === '-' ? -valor : valor
    }
    if (token.tipo === 'funcao') {
      next(); const abre = next()
      if (abre?.tipo !== 'operador' || abre.valor !== '(') throw new FormulaAcessorioError(`${token.valor} sem parênteses`)
      const valor = expr(); const fecha = next()
      if (fecha?.tipo !== 'operador' || fecha.valor !== ')') throw new FormulaAcessorioError(`${token.valor} sem fechamento`)
      return token.valor === 'CEIL' ? Math.ceil(valor) : Math.round(valor)
    }
    if (token.tipo === 'numero') { next(); return Number(token.valor) }
    if (token.tipo === 'identificador') {
      next()
      if (!(token.valor in contexto)) throw new FormulaAcessorioError(`Referência "${token.valor}" ainda não possui valor`)
      return contexto[token.valor]
    }
    throw new FormulaAcessorioError(`Token inesperado em "${formula}"`)
  }

  const resultado = expr()
  if (pos !== tokens.length || !Number.isFinite(resultado)) throw new FormulaAcessorioError(`Fórmula inválida: "${formula}"`)
  return resultado
}

function numero(valor: number) {
  return Number.isInteger(valor) ? String(valor) : String(Number(valor.toFixed(6)))
}

function mostrarCalculo(formula: string, contexto: Record<string, number>) {
  return formula.replace(/\b[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*\b/g, token => {
    if (token === 'ROUND' || token === 'CEIL') return token
    return token in contexto ? numero(contexto[token]) : token
  })
}

export function calcularAcessoriosTecnicos(
  acessorios: AcessorioFormulaCorte[],
  largura: number,
  altura: number,
  folhas: number,
  perfis: Array<{ codigo: string; tamanho: number }>
): ResultadoAcessorioFormula[] {
  const contexto: Record<string, number> = {
    Largura: largura,
    Altura: altura,
    LF: largura - 4,
    HF: altura - 4,
    Folhas: Math.max(1, folhas || 1),
    Encontros: Math.max(0, (folhas || 1) - 1),
  }
  for (const perfil of perfis) if (perfil.codigo && Number.isFinite(perfil.tamanho)) contexto[perfil.codigo] = perfil.tamanho

  return acessorios.map((item, index) => {
    const formula = item.formula_quantidade?.trim() || ''
    if (!formula) {
      if (typeof item.quantidade_referencia === 'number') contexto[item.codigo] = item.quantidade_referencia
      return { index, valor: null, calculo: 'Referência do PDF; fórmula ainda não validada.' }
    }
    try {
      const antes = { ...contexto }
      const valor = avaliar(formula, contexto)
      contexto[item.codigo] = valor
      return { index, valor, calculo: mostrarCalculo(formula, antes) }
    } catch (e) {
      return { index, valor: null, calculo: formula, erro: e instanceof Error ? e.message : 'Fórmula inválida' }
    }
  })
}
