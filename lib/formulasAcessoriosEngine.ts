export type AcessorioFormulaCorte = {
  codigo: string
  descricao?: string
  unidade?: string
  formula?: string
  quantidade_base?: number
  cor?: string
  origem_calculo?: string
  observacao?: string
  ativo?: boolean
}

export type ResultadoAcessorioFormula = {
  codigo: string
  descricao?: string
  unidade: string
  quantidade: number
  formula?: string
  calculo?: string
  cor?: string
  origem_calculo?: string
  observacao?: string
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

    throw new FormulaAcessorioError(`Caractere não permitido "${char}" na fórmula "${formula}"`)
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

  function parseExpr(): number {
    let valor = parseTerm()
    while (operador('+') || operador('-')) {
      const op = next() as Extract<Token, { tipo: 'operador' }>
      const rhs = parseTerm()
      valor = op.valor === '+' ? valor + rhs : valor - rhs
    }
    return valor
  }

  function parseTerm(): number {
    let valor = parseFactor()
    while (operador('*') || operador('/')) {
      const op = next() as Extract<Token, { tipo: 'operador' }>
      const rhs = parseFactor()
      if (op.valor === '/' && rhs === 0) throw new FormulaAcessorioError(`Divisão por zero em "${formula}"`)
      valor = op.valor === '*' ? valor * rhs : valor / rhs
    }
    return valor
  }

  function parseFactor(): number {
    const token = peek()
    if (!token) throw new FormulaAcessorioError(`Fórmula incompleta: "${formula}"`)

    if (token.tipo === 'operador' && token.valor === '(') {
      next()
      const valor = parseExpr()
      const fechamento = next()
      if (fechamento?.tipo !== 'operador' || fechamento.valor !== ')') throw new FormulaAcessorioError(`Parênteses não fechados em "${formula}"`)
      return valor
    }

    if (token.tipo === 'operador' && (token.valor === '-' || token.valor === '+')) {
      next()
      const valor = parseFactor()
      return token.valor === '-' ? -valor : valor
    }

    if (token.tipo === 'funcao') {
      next()
      const abertura = next()
      if (abertura?.tipo !== 'operador' || abertura.valor !== '(') throw new FormulaAcessorioError(`${token.valor} sem parênteses em "${formula}"`)
      const valor = parseExpr()
      const fechamento = next()
      if (fechamento?.tipo !== 'operador' || fechamento.valor !== ')') throw new FormulaAcessorioError(`${token.valor} sem fechamento em "${formula}"`)
      return token.valor === 'CEIL' ? Math.ceil(valor) : Math.round(valor)
    }

    if (token.tipo === 'numero') { next(); return Number(token.valor) }
    if (token.tipo === 'identificador') {
      next()
      if (!(token.valor in contexto)) throw new FormulaAcessorioError(`Referência "${token.valor}" ainda não possui valor para calcular "${formula}"`)
      return contexto[token.valor]
    }

    throw new FormulaAcessorioError(`Token inesperado em "${formula}"`)
  }

  const resultado = parseExpr()
  if (pos !== tokens.length) throw new FormulaAcessorioError(`Conteúdo não interpretado em "${formula}"`)
  if (!Number.isFinite(resultado)) throw new FormulaAcessorioError(`Resultado inválido em "${formula}"`)
  return resultado
}

function mostrarNumero(valor: number) {
  return Number.isInteger(valor) ? String(valor) : String(Number(valor.toFixed(6)))
}

function formulaComValores(formula: string, contexto: Record<string, number>) {
  return formula.replace(/\b[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*\b/g, token => {
    if (token === 'ROUND' || token === 'CEIL') return token
    return token in contexto ? mostrarNumero(contexto[token]) : token
  })
}

export function calcularAcessoriosFormula(
  acessorios: AcessorioFormulaCorte[],
  largura: number,
  altura: number,
  folhas: number,
  perfis: Array<{ codigo: string; tamanho: number }>
): ResultadoAcessorioFormula[] {
  if (!Number.isFinite(largura) || largura <= 0 || !Number.isFinite(altura) || altura <= 0) {
    throw new FormulaAcessorioError('Largura/altura inválida para acessórios.')
  }

  const contexto: Record<string, number> = {
    Largura: largura,
    Altura: altura,
    LF: largura - 4,
    HF: altura - 4,
    Folhas: Math.max(1, folhas || 1),
    Encontros: Math.max(0, (folhas || 1) - 1),
  }

  for (const perfil of perfis) {
    if (perfil.codigo && Number.isFinite(perfil.tamanho)) contexto[perfil.codigo] = perfil.tamanho
  }

  const resultados: ResultadoAcessorioFormula[] = []
  for (const acessorio of acessorios || []) {
    if (acessorio.ativo === false || !acessorio.codigo?.trim()) continue
    const formula = acessorio.formula?.trim() || ''
    const contextoAntes = { ...contexto }
    const quantidade = formula
      ? avaliar(formula, contexto)
      : Number(acessorio.quantidade_base || 0)

    const codigo = acessorio.codigo.trim().toUpperCase()
    contexto[codigo] = quantidade
    resultados.push({
      codigo,
      descricao: acessorio.descricao,
      unidade: acessorio.unidade || 'UN',
      quantidade,
      formula: formula || undefined,
      calculo: formula ? formulaComValores(formula, contextoAntes) : `Quantidade fixa: ${mostrarNumero(quantidade)}`,
      cor: acessorio.cor,
      origem_calculo: acessorio.origem_calculo,
      observacao: acessorio.observacao,
    })
  }

  return resultados
}
