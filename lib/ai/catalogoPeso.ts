// Peso tecnico em kg/m: tres casas apos ponto sao decimais,
// nao separador de milhar (0.375 kg/m nunca pode virar 375 kg/m).
export function pesoDecimalCatalogo(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  if (valor === null || valor === undefined || valor === '') return null
  const texto = String(valor).trim().replace(/\s*kg\s*\/?\s*m\s*$/i, '').replace(/\s+/g, '')
  if (!/^[+-]?[\d.,]+$/.test(texto)) return null
  const ultimaVirgula = texto.lastIndexOf(',')
  const ultimoPonto = texto.lastIndexOf('.')
  // Se ambos aparecem, a ultima pontuacao e decimal; a outra e agrupamento.
  let decimal = texto
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    decimal = ultimaVirgula > ultimoPonto
      ? texto.replace(/\./g, '').replace(',', '.')
      : texto.replace(/,/g, '')
  } else if (ultimaVirgula >= 0) decimal = texto.replace(',', '.')
  if ((decimal.match(/\./g) || []).length > 1) return null
  const resultado = Number(decimal)
  return Number.isFinite(resultado) ? resultado : null
}
