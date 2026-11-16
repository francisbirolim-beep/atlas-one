/**
 * Entrada assistida do visor Bosch. Três leituras em ordem visual
 * de cima para baixo: ponto/vírgula decimais representam metros;
 * inteiros representam milímetros. Nunca atribui valores sem confirmação.
 */
export function interpretarTresLeiturasTrena(texto: string): number[] | null {
  const entradas = texto.trim().split(/[\s;\/|]+/).filter(Boolean)
  if (entradas.length !== 3) return null
  const valores = entradas.map(valor => {
    const limpo = valor.replace(/m$/i, '').trim()
    if (!/^\d+(?:[.,]\d{1,3})?$/.test(limpo)) return NaN
    const numero = Number(limpo.replace(',', '.'))
    const mm = numero < 20 ? Math.round(numero * 1000) : Math.round(numero)
    return mm >= 100 && mm <= 10000 ? mm : NaN
  })
  return valores.every(v => Number.isFinite(v)) ? valores : null
}
