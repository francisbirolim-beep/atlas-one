/**
 * Normaliza respostas da IA de leitura de trena sem assumir posições físicas.
 * A ordem visual recebida é preservada; o mapeamento para os campos
 * baixo/meio/cima ou direita/meio/esquerda pertence ao formulário.
 */
type Unidade = 'mm' | 'cm' | 'm'

function converterDistancia(entrada: unknown, unidadePadrao: Unidade): number | null {
  let valor = entrada
  let unidade: Unidade = unidadePadrao

  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const objeto = valor as Record<string, unknown>
    valor = objeto.valor ?? objeto.value ?? objeto.medida
    const declarada = String(objeto.unidade ?? objeto.unit ?? '').toLowerCase().trim()
    if (declarada === 'mm' || declarada === 'cm' || declarada === 'm') unidade = declarada
  }

  let numero: number
  let decimalSemUnidade = false

  if (typeof valor === 'number') {
    numero = valor
    decimalSemUnidade = valor > 0 && valor < 10 && /^\d+[.]\d{3}$/.test(String(valor))
  } else if (typeof valor === 'string') {
    const correspondencia = valor.trim().match(/^(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?$/i)
    if (!correspondencia) return null
    numero = Number(correspondencia[1].replace(',', '.'))
    const explicita = correspondencia[2]?.toLowerCase()
    if (explicita === 'mm' || explicita === 'cm' || explicita === 'm') unidade = explicita
    decimalSemUnidade = !explicita && numero > 0 && numero < 10 &&
      /^\d+[.,]\d{3}$/.test(correspondencia[1])
  } else {
    return null
  }

  if (!Number.isFinite(numero) || numero <= 0) return null
  // Alguns modelos devolvem "1.195" mesmo sob a chave medidas_mm.
  // Só inferimos metros na notação inequívoca com três casas e valor < 10.
  const escala = unidade === 'm' ? 1000 : unidade === 'cm' ? 10 :
    decimalSemUnidade ? 1000 : 1
  const milimetros = Math.round(numero * escala)
  return milimetros > 0 && milimetros <= 10000 ? milimetros : null
}

export function extrairMedidasMmDeResposta(texto: string): number[] {
  const cerca = String.fromCharCode(96).repeat(3)
  let resposta = String(texto || '').trim()
  if (resposta.startsWith(cerca)) {
    resposta = resposta.replace(new RegExp('^' + cerca + '(?:json)?\\s*', 'i'), '')
      .replace(new RegExp(cerca + '\\s*$'), '').trim()
  }

  let objeto: unknown
  try {
    objeto = JSON.parse(resposta)
  } catch {
    const inicio = resposta.indexOf('{')
    const fim = resposta.lastIndexOf('}')
    if (inicio < 0 || fim <= inicio) return []
    try { objeto = JSON.parse(resposta.slice(inicio, fim + 1)) } catch { return [] }
  }

  let valores: unknown[] | null = null
  let unidade: Unidade = 'mm'
  if (Array.isArray(objeto)) {
    valores = objeto
  } else if (objeto && typeof objeto === 'object') {
    const dados = objeto as Record<string, unknown>
    for (const [chave, unidadeChave] of [
      ['medidas_mm', 'mm'], ['medidas_m', 'm'], ['medidas_cm', 'cm'],
      ['leituras_mm', 'mm'], ['distancias_mm', 'mm'],
    ] as const) {
      if (Array.isArray(dados[chave])) {
        valores = dados[chave] as unknown[]
        unidade = unidadeChave
        break
      }
    }
  }

  if (!valores || valores.length > 3) return []
  return valores.map(valor => converterDistancia(valor, unidade))
    .filter((valor): valor is number => valor !== null)
}