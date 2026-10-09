// Motor declarativo e seguro de formulas de corte por tipologia.
//
// A definicao e lida de engenharia_tipologia_formulas_corte. O motor nao usa
// eval nem Function(): somente numeros, identificadores conhecidos,
// + - * /, parenteses, ROUND(expr), CEIL(expr) e FLOOR(expr) sao aceitos.

export type VariavelTipologia = {
  chave: string
  label: string
  opcoes: string[]
}

export type CondicaoFormula = {
  quando: Record<string, string[]>
  formula: string
}

export type PecaFormula = {
  codigo?: string
  grupo?: string
  descricao?: string
  formula?: string
  formula_L?: string
  formula_H?: string
  condicoes?: CondicaoFormula[]
  condicao_ativa?: Record<string, string[]>
  variaveis_chave?: string[]
  mapa_codigo?: Record<string, string>
  formula_por_variavel?: Record<string, string>
  quantidade?: number
  formula_quantidade?: string
  eixo?: 'L' | 'H'
  composicao_desconto?: string
}

export type TipologiaFormulasCorte = {
  tipologia_id: string
  variaveis: VariavelTipologia[]
  pecas: PecaFormula[]
}

export type OpcoesEscolhidas = Record<string, string>

export type ResultadoPeca = {
  codigo: string
  grupo?: string
  descricao?: string
  tamanho: number
  eixo?: 'L' | 'H'
  quantidade?: number
  composicao_desconto?: string
}

type Token =
  | { tipo: 'numero'; valor: string }
  | { tipo: 'identificador'; valor: string }
  | { tipo: 'funcao'; valor: 'ROUND' | 'CEIL' | 'FLOOR' }
  | { tipo: 'operador'; valor: '+' | '-' | '*' | '/' | '(' | ')' }

export class FormulaCorteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FormulaCorteError'
  }
}

class DependenciaFormulaPendente extends FormulaCorteError {}

function tokenizar(formula: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < formula.length) {
    const restante = formula.slice(i)
    const espaco = restante.match(/^\s+/)
    if (espaco) {
      i += espaco[0].length
      continue
    }

    const numero = restante.match(/^\d+(?:\.\d+)?/)
    if (numero) {
      tokens.push({ tipo: 'numero', valor: numero[0] })
      i += numero[0].length
      continue
    }

    const identificador = restante.match(/^[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*/)
    if (identificador) {
      const valor = identificador[0]
      if (valor === 'ROUND' || valor === 'CEIL' || valor === 'FLOOR') {
        tokens.push({ tipo: 'funcao', valor })
      } else {
        tokens.push({ tipo: 'identificador', valor })
      }
      i += valor.length
      continue
    }

    const char = formula[i]
    if (char === '+' || char === '-' || char === '*' || char === '/' || char === '(' || char === ')') {
      tokens.push({ tipo: 'operador', valor: char })
      i += 1
      continue
    }

    throw new FormulaCorteError(
      `Caractere nao permitido "${char}" na posicao ${i + 1} da formula "${formula}"`
    )
  }

  if (tokens.length === 0) {
    throw new FormulaCorteError(`Formula vazia ou invalida: "${formula}"`)
  }

  return tokens
}

function avaliarFormula(formula: string, contexto: Record<string, number>): number {
  const tokens = tokenizar(formula)
  let pos = 0

  function peek(): Token | undefined {
    return tokens[pos]
  }

  function next(): Token | undefined {
    return tokens[pos++]
  }

  function operador(valor: string): boolean {
    const token = peek()
    return token?.tipo === 'operador' && token.valor === valor
  }

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
      if (op.valor === '/' && rhs === 0) {
        throw new FormulaCorteError(`Divisao por zero na formula "${formula}"`)
      }
      valor = op.valor === '*' ? valor * rhs : valor / rhs
    }

    return valor
  }

  function parseFactor(): number {
    const token = peek()
    if (!token) throw new FormulaCorteError(`Formula incompleta: "${formula}"`)

    if (token.tipo === 'operador' && token.valor === '(') {
      next()
      const valor = parseExpr()
      const fechamento = next()
      if (fechamento?.tipo !== 'operador' || fechamento.valor !== ')') {
        throw new FormulaCorteError(`Parenteses nao fechados em "${formula}"`)
      }
      return valor
    }

    if (token.tipo === 'operador' && token.valor === '-') {
      next()
      return -parseFactor()
    }

    if (token.tipo === 'operador' && token.valor === '+') {
      next()
      return parseFactor()
    }

    if (token.tipo === 'funcao') {
      next()
      const abertura = next()
      if (abertura?.tipo !== 'operador' || abertura.valor !== '(') {
        throw new FormulaCorteError(`${token.valor} sem parenteses em "${formula}"`)
      }
      const valor = parseExpr()
      const fechamento = next()
      if (fechamento?.tipo !== 'operador' || fechamento.valor !== ')') {
        throw new FormulaCorteError(`${token.valor} sem fechamento em "${formula}"`)
      }
      return token.valor === 'CEIL' ? Math.ceil(valor) : token.valor === 'FLOOR' ? Math.floor(valor) : Math.round(valor)
    }

    if (token.tipo === 'numero') {
      next()
      return Number(token.valor)
    }

    if (token.tipo === 'identificador') {
      next()
      if (!(token.valor in contexto)) {
        throw new DependenciaFormulaPendente(
          `Variavel ou dependencia desconhecida "${token.valor}" na formula "${formula}"`
        )
      }
      return contexto[token.valor]
    }

    throw new FormulaCorteError(`Token inesperado na formula "${formula}"`)
  }

  const resultado = parseExpr()

  if (pos !== tokens.length) {
    const token = tokens[pos]
    throw new FormulaCorteError(
      `Conteudo nao interpretado "${token?.valor ?? ''}" na formula "${formula}"`
    )
  }

  if (!Number.isFinite(resultado)) {
    throw new FormulaCorteError(`Resultado nao finito na formula "${formula}"`)
  }

  return resultado
}

function contextoBase(largura: number, altura: number): Record<string, number> {
  return {
    Largura: largura,
    Altura: altura,
    // LF/HF representam a medida final de fabricacao apos a folga total de
    // encaixe de 4 mm validada para estas receitas Suprema.
    LF: largura - 4,
    HF: altura - 4,
  }
}

export function calcularFormulaCorteIsolada(formula: string, largura: number, altura: number, numeroFolhas?: number): number {
  if (!Number.isFinite(largura) || largura <= 0) throw new FormulaCorteError('Largura invalida')
  if (!Number.isFinite(altura) || altura <= 0) throw new FormulaCorteError('Altura invalida')
  const contexto = contextoBase(largura, altura)
  if (numeroFolhas !== undefined) {
    if (!Number.isInteger(numeroFolhas) || numeroFolhas < 2 || numeroFolhas > 6) throw new FormulaCorteError('Número de folhas inválido.')
    contexto.Folhas = numeroFolhas
    contexto.Encontros = numeroFolhas - 1
  }
  return avaliarFormula(formula, contexto)
}

export function condicaoBate(quando: Record<string, string[]>, opcoes: OpcoesEscolhidas): boolean {
  return Object.entries(quando).every(([chave, valoresAceitos]) => {
    const escolhido = opcoes[chave]
    return escolhido !== undefined && valoresAceitos.includes(escolhido)
  })
}

function validarOpcoes(def: TipologiaFormulasCorte, opcoes: OpcoesEscolhidas) {
  for (const variavel of def.variaveis ?? []) {
    const valor = opcoes[variavel.chave]
    if (valor === undefined || valor === '') {
      throw new FormulaCorteError(`Selecione uma opcao para "${variavel.label}" (${variavel.chave})`)
    }
    if (variavel.opcoes.length > 0 && !variavel.opcoes.includes(valor)) {
      throw new FormulaCorteError(
        `Opcao invalida "${valor}" para "${variavel.label}". Permitidas: ${variavel.opcoes.join(', ')}`
      )
    }
  }
}

export function resolverFormulaCondicional(
  formulaBase: string,
  condicoes: CondicaoFormula[] | undefined,
  opcoes: OpcoesEscolhidas
): string {
  let formula = formulaBase
  for (const condicao of condicoes ?? []) {
    if (condicaoBate(condicao.quando, opcoes)) formula = condicao.formula
  }
  return formula
}

function formulaComCondicoes(peca: PecaFormula, opcoes: OpcoesEscolhidas): string {
  if (!peca.formula) throw new FormulaCorteError('Peca sem formula base')
  return resolverFormulaCondicional(peca.formula, peca.condicoes, opcoes)
}

function quantidadeResolvida(peca: PecaFormula, contexto: Record<string, number>): number | undefined {
  if (!String(peca.formula_quantidade || '').trim()) return peca.quantidade
  const valor = avaliarFormula(String(peca.formula_quantidade), contexto)
  if (valor <= 0) {
    throw new FormulaCorteError(
      `Quantidade calculada invalida (${valor}) para "${peca.codigo || peca.grupo || 'sem-identificador'}"`
    )
  }
  return valor
}

function enriquecerResultado(
  peca: PecaFormula,
  resultado: Omit<ResultadoPeca, 'quantidade' | 'composicao_desconto'>,
  contexto: Record<string, number>,
): ResultadoPeca {
  return {
    ...resultado,
    grupo: peca.grupo,
    quantidade: quantidadeResolvida(peca, contexto),
    composicao_desconto: peca.composicao_desconto,
  }
}

// Regra técnica Esquadrifácio: travessas e baguetes horizontais ligados ao
// mesmo vão sempre recebem comprimento inteiro arredondado para cima.
// O padrão do WVetro não prevalece quando faz truncamento.
function avaliarComprimentoPeca(peca: PecaFormula, codigo: string, formula: string, contexto: Record<string, number>): number {
  const identificacao = `${codigo} ${peca.grupo || ''} ${peca.descricao || ''}`
  const arredondarParaCima = /\btravessa(s)?\b/i.test(identificacao)
    || /\bbaguete horizontal\b/i.test(identificacao)
    || /\bSU053\b|\bSU225\b/i.test(codigo)

  if (!arredondarParaCima) return avaliarFormula(formula, contexto)

  // Algumas receitas antigas aplicavam FLOOR/ROUND ao resultado final.
  // Substituí-los pela regra nova evita perder a fração antes do CEIL.
  const formulaSemArredondamentoAntigo = formula.trim().replace(/^(FLOOR|ROUND)\(/i, 'CEIL(')
  return Math.ceil(avaliarFormula(formulaSemArredondamentoAntigo, contexto))
}

function tentarResolverPeca(
  peca: PecaFormula,
  contexto: Record<string, number>,
  opcoes: OpcoesEscolhidas
): ResultadoPeca[] | null {
  if (peca.condicao_ativa && !condicaoBate(peca.condicao_ativa, opcoes)) {
    return []
  }

  try {
    if (peca.codigo && peca.formula) {
      const tamanho = avaliarComprimentoPeca(peca, peca.codigo, formulaComCondicoes(peca, opcoes), contexto)
      contexto[peca.codigo] = tamanho
      return [enriquecerResultado(peca, {
        codigo: peca.codigo,
        descricao: peca.descricao,
        tamanho,
        eixo: peca.eixo,
      }, contexto)]
    }

    if (peca.codigo && (peca.formula_L || peca.formula_H)) {
      const resultados: ResultadoPeca[] = []
      if (peca.formula_L) {
        resultados.push(enriquecerResultado(peca, {
          codigo: peca.codigo,
          descricao: peca.descricao,
          tamanho: avaliarComprimentoPeca(peca, peca.codigo, peca.formula_L, contexto),
          eixo: 'L',
        }, contexto))
      }
      if (peca.formula_H) {
        resultados.push(enriquecerResultado(peca, {
          codigo: peca.codigo,
          descricao: peca.descricao,
          tamanho: avaliarComprimentoPeca(peca, peca.codigo, peca.formula_H, contexto),
          eixo: 'H',
        }, contexto))
      }
      return resultados
    }

    if (peca.grupo && peca.mapa_codigo && peca.formula) {
      const chaveCombinada = (peca.variaveis_chave ?? []).map((chave) => opcoes[chave]).join('|')
      const codigoResolvido = peca.mapa_codigo[chaveCombinada]
      if (!codigoResolvido) {
        throw new FormulaCorteError(
          `Nao foi encontrado codigo de perfil para o grupo "${peca.grupo}" com combinacao "${chaveCombinada}"`
        )
      }
      const tamanho = avaliarComprimentoPeca(peca, codigoResolvido, formulaComCondicoes(peca, opcoes), contexto)
      contexto[codigoResolvido] = tamanho
      // Mantém também um alias estável pelo nome do grupo. Assim fórmulas
      // posteriores (especialmente acessórios) podem depender do comprimento
      // calculado sem precisar saber qual código físico foi escolhido pelo mapa.
      contexto[peca.grupo] = tamanho
      return [enriquecerResultado(peca, {
        codigo: codigoResolvido,
        descricao: peca.descricao,
        tamanho,
        eixo: peca.eixo,
      }, contexto)]
    }

    if (peca.grupo && peca.formula_por_variavel) {
      const chaveVariavel = peca.variaveis_chave?.[0]
      const valorEscolhido = chaveVariavel ? opcoes[chaveVariavel] : undefined
      const formula = valorEscolhido ? peca.formula_por_variavel[valorEscolhido] : undefined
      if (!formula) {
        throw new FormulaCorteError(
          `Nao ha formula para o grupo "${peca.grupo}" com a opcao "${valorEscolhido ?? ''}"`
        )
      }
      const tamanho = avaliarComprimentoPeca(peca, peca.grupo, formula, contexto)
      return [enriquecerResultado(peca, {
        codigo: peca.grupo,
        descricao: peca.descricao,
        tamanho,
        eixo: peca.eixo,
      }, contexto)]
    }

    throw new FormulaCorteError(
      `Definicao de peca invalida: informe codigo/grupo e uma formula suportada`
    )
  } catch (erro) {
    if (erro instanceof DependenciaFormulaPendente) return null
    throw erro
  }
}

/**
 * Calcula os tamanhos de corte para uma tipologia.
 *
 * As pecas sao resolvidas declarativamente. Dependencias como `TMC = SU010`
 * podem aparecer antes ou depois da peca referenciada: o motor repete as
 * tentativas enquanto houver progresso e acusa dependencia circular/dado
 * faltando quando nenhuma nova peca puder ser resolvida.
 */
export function calcularFormulasCorte(
  def: TipologiaFormulasCorte,
  largura: number,
  altura: number,
  opcoes: OpcoesEscolhidas
): ResultadoPeca[] {
  if (!Number.isFinite(largura) || largura <= 0) {
    throw new FormulaCorteError('Largura invalida')
  }
  if (!Number.isFinite(altura) || altura <= 0) {
    throw new FormulaCorteError('Altura invalida')
  }
  if (!def || !Array.isArray(def.pecas) || !Array.isArray(def.variaveis)) {
    throw new FormulaCorteError('Definicao de formulas de corte invalida')
  }

  validarOpcoes(def, opcoes)

  const contexto = contextoBase(largura, altura)
  // A tipologia unica de correr usa numero_folhas como variavel da arvore.
  // Receitas legadas sem esta variavel continuam com seu comportamento atual.
  if (def.variaveis.some(v => v.chave === 'numero_folhas')) {
    const folhas = Number(opcoes.numero_folhas)
    if (!Number.isInteger(folhas) || folhas < 2 || folhas > 6) {
      throw new FormulaCorteError('Porta sequencial Suprema: escolha de 2 a 6 folhas.')
    }
    contexto.Folhas = folhas
    contexto.Encontros = folhas - 1
  }
  const resultados: ResultadoPeca[] = []
  let pendentes = [...def.pecas]

  while (pendentes.length > 0) {
    const proximaRodada: PecaFormula[] = []
    let progresso = 0

    for (const peca of pendentes) {
      const resolvidos = tentarResolverPeca(peca, contexto, opcoes)
      if (resolvidos === null) {
        proximaRodada.push(peca)
        continue
      }
      resultados.push(...resolvidos)
      progresso += 1
    }

    if (proximaRodada.length === 0) break

    if (progresso === 0) {
      const nomes = proximaRodada.map((peca) => peca.codigo || peca.grupo || 'sem-identificador').join(', ')
      throw new FormulaCorteError(
        `Nao foi possivel resolver ${proximaRodada.length} peca(s): ${nomes}. Verifique dependencia circular, codigo de referencia ou dado faltando.`
      )
    }

    pendentes = proximaRodada
  }

  return resultados
}
