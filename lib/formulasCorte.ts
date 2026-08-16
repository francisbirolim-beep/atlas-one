// Motor restrito de formulas do Plano de Corte.
//
// IMPORTANTE: nunca usar eval/new Function para formulas cadastradas no banco.
// A sintaxe aceita somente numeros, variaveis conhecidas, operadores aritmeticos,
// parenteses e um conjunto pequeno de funcoes matematicas permitidas.

export const VARIAVEIS_FORMULA_CORTE = [
  'largura',
  'altura',
  'quantidade',
  'folga_largura',
  'folga_altura',
  'folhas',
] as const

export type VariavelFormulaCorte = (typeof VARIAVEIS_FORMULA_CORTE)[number]
export type ContextoFormulaCorte = Record<VariavelFormulaCorte, number>

export type ResultadoFormulaCorte =
  | { ok: true; valor: number }
  | { ok: false; erro: string }

type TipoToken = 'numero' | 'identificador' | 'operador' | 'abre' | 'fecha' | 'virgula'
type Token = { tipo: TipoToken; valor: string }

const FUNCOES: Record<string, (...args: number[]) => number> = {
  abs: (a) => Math.abs(a),
  ceil: (a) => Math.ceil(a),
  floor: (a) => Math.floor(a),
  round: (a) => Math.round(a),
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
}

function tokenizar(formula: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < formula.length) {
    const c = formula[i]

    if (/\s/.test(c)) {
      i += 1
      continue
    }

    if (/[0-9.]/.test(c)) {
      const inicio = i
      let pontos = 0
      while (i < formula.length && /[0-9.]/.test(formula[i])) {
        if (formula[i] === '.') pontos += 1
        i += 1
      }
      const valor = formula.slice(inicio, i)
      if (pontos > 1 || valor === '.') throw new Error(`Número inválido: ${valor}`)
      tokens.push({ tipo: 'numero', valor })
      continue
    }

    if (/[A-Za-z_]/.test(c)) {
      const inicio = i
      while (i < formula.length && /[A-Za-z0-9_]/.test(formula[i])) i += 1
      tokens.push({ tipo: 'identificador', valor: formula.slice(inicio, i).toLowerCase() })
      continue
    }

    if ('+-*/'.includes(c)) {
      tokens.push({ tipo: 'operador', valor: c })
      i += 1
      continue
    }

    if (c === '(') {
      tokens.push({ tipo: 'abre', valor: c })
      i += 1
      continue
    }

    if (c === ')') {
      tokens.push({ tipo: 'fecha', valor: c })
      i += 1
      continue
    }

    if (c === ',') {
      tokens.push({ tipo: 'virgula', valor: c })
      i += 1
      continue
    }

    throw new Error(`Caractere não permitido na fórmula: ${c}`)
  }

  return tokens
}

class ParserFormula {
  private pos = 0

  constructor(
    private readonly tokens: Token[],
    private readonly contexto: ContextoFormulaCorte
  ) {}

  avaliar(): number {
    if (this.tokens.length === 0) throw new Error('Fórmula vazia.')
    const valor = this.expressao()
    if (this.pos !== this.tokens.length) {
      throw new Error(`Trecho inesperado: ${this.tokens[this.pos].valor}`)
    }
    return valor
  }

  private atual(): Token | undefined {
    return this.tokens[this.pos]
  }

  private consumir(): Token {
    const token = this.tokens[this.pos]
    if (!token) throw new Error('Fim inesperado da fórmula.')
    this.pos += 1
    return token
  }

  private expressao(): number {
    let valor = this.termo()
    while (this.atual()?.tipo === 'operador' && ['+', '-'].includes(this.atual()!.valor)) {
      const op = this.consumir().valor
      const direita = this.termo()
      valor = op === '+' ? valor + direita : valor - direita
    }
    return valor
  }

  private termo(): number {
    let valor = this.unario()
    while (this.atual()?.tipo === 'operador' && ['*', '/'].includes(this.atual()!.valor)) {
      const op = this.consumir().valor
      const direita = this.unario()
      if (op === '/' && direita === 0) throw new Error('Divisão por zero.')
      valor = op === '*' ? valor * direita : valor / direita
    }
    return valor
  }

  private unario(): number {
    if (this.atual()?.tipo === 'operador' && ['+', '-'].includes(this.atual()!.valor)) {
      const op = this.consumir().valor
      const valor = this.unario()
      return op === '-' ? -valor : valor
    }
    return this.primario()
  }

  private primario(): number {
    const token = this.consumir()

    if (token.tipo === 'numero') return Number(token.valor)

    if (token.tipo === 'abre') {
      const valor = this.expressao()
      if (this.consumir().tipo !== 'fecha') throw new Error('Parêntese não fechado.')
      return valor
    }

    if (token.tipo !== 'identificador') {
      throw new Error(`Valor inesperado: ${token.valor}`)
    }

    if (this.atual()?.tipo === 'abre') {
      this.consumir()
      const args: number[] = []
      if (this.atual()?.tipo !== 'fecha') {
        args.push(this.expressao())
        while (this.atual()?.tipo === 'virgula') {
          this.consumir()
          args.push(this.expressao())
        }
      }
      if (this.consumir().tipo !== 'fecha') throw new Error('Parêntese da função não fechado.')

      const funcao = FUNCOES[token.valor]
      if (!funcao) throw new Error(`Função não permitida: ${token.valor}`)
      if (args.length === 0) throw new Error(`Função ${token.valor} exige argumento.`)
      if (!['min', 'max'].includes(token.valor) && args.length !== 1) {
        throw new Error(`Função ${token.valor} aceita apenas um argumento.`)
      }
      return funcao(...args)
    }

    if (!VARIAVEIS_FORMULA_CORTE.includes(token.valor as VariavelFormulaCorte)) {
      throw new Error(`Variável não permitida: ${token.valor}`)
    }

    const valor = this.contexto[token.valor as VariavelFormulaCorte]
    if (!Number.isFinite(valor)) throw new Error(`Variável sem valor válido: ${token.valor}`)
    return valor
  }
}

export function avaliarFormulaCorte(
  formula: string | null | undefined,
  contexto: ContextoFormulaCorte
): ResultadoFormulaCorte {
  const texto = (formula || '').trim()
  if (!texto) return { ok: false, erro: 'Fórmula não informada.' }

  try {
    const tokens = tokenizar(texto)
    const valor = new ParserFormula(tokens, contexto).avaliar()
    if (!Number.isFinite(valor)) return { ok: false, erro: 'Resultado numérico inválido.' }
    return { ok: true, valor }
  } catch (erro) {
    return {
      ok: false,
      erro: erro instanceof Error ? erro.message : 'Fórmula inválida.',
    }
  }
}

export function criarContextoFormulaCorte(dados: {
  largura?: number | null
  altura?: number | null
  quantidade?: number | null
  folga_largura?: number | null
  folga_altura?: number | null
  folhas?: number | string | null
}): ContextoFormulaCorte {
  const folhas = typeof dados.folhas === 'string'
    ? Number(dados.folhas.replace(/[^0-9.-]/g, ''))
    : Number(dados.folhas ?? 0)

  return {
    largura: Number(dados.largura ?? 0),
    altura: Number(dados.altura ?? 0),
    quantidade: Number(dados.quantidade ?? 1),
    folga_largura: Number(dados.folga_largura ?? 0),
    folga_altura: Number(dados.folga_altura ?? 0),
    folhas: Number.isFinite(folhas) ? folhas : 0,
  }
}
