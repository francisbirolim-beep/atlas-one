export function precoPorMargemReal(custo: number | null | undefined, margemPercentual: number | null | undefined): number | null {
  const c = Number(custo)
  const m = Number(margemPercentual)
  if (!Number.isFinite(c) || c < 0 || !Number.isFinite(m) || m < 0 || m >= 100) return null
  return c / (1 - m / 100)
}

export function margemRealPorPreco(custo: number | null | undefined, preco: number | null | undefined): number | null {
  const c = Number(custo)
  const p = Number(preco)
  if (!Number.isFinite(c) || c < 0 || !Number.isFinite(p) || p <= 0) return null
  return ((p - c) / p) * 100
}

export function precoVendaBalcao(produto: { preco?: number | null; preco_promocional?: number | null }): number {
  const promo = Number(produto.preco_promocional)
  if (Number.isFinite(promo) && promo > 0) return promo
  const normal = Number(produto.preco)
  return Number.isFinite(normal) && normal > 0 ? normal : 0
}

export function margemVendaBalcao(produto: { custo?: number | null; preco?: number | null; preco_promocional?: number | null }): number | null {
  return margemRealPorPreco(produto.custo, precoVendaBalcao(produto))
}

export function abaixoDoPrecoMinimo(produto: { preco_minimo?: number | null }, preco: number): boolean {
  const minimo = Number(produto.preco_minimo)
  return Number.isFinite(minimo) && minimo > 0 && preco < minimo
}

export function arredondarMoeda(valor: number | null): number | null {
  return valor == null ? null : Math.round((valor + Number.EPSILON) * 100) / 100
}

// Percentual aplicado AO CUSTO (acréscimo / markup), diferente da margem real
// sobre o preço de venda. Não substituir margem_percentual do banco por markup.
export function precoPorAcrescimoSobreCusto(custo: number | null | undefined, acrescimoPercentual: number | null | undefined): number | null {
  if (custo == null || acrescimoPercentual == null) return null
  const c = Number(custo)
  const a = Number(acrescimoPercentual)
  if (!Number.isFinite(c) || c < 0 || !Number.isFinite(a) || a < 0) return null
  return c * (1 + a / 100)
}

export function acrescimoSobreCustoPorPreco(custo: number | null | undefined, preco: number | null | undefined): number | null {
  if (custo == null || preco == null) return null
  const c = Number(custo)
  const p = Number(preco)
  if (!Number.isFinite(c) || c <= 0 || !Number.isFinite(p) || p < 0) return null
  return ((p - c) / c) * 100
}
