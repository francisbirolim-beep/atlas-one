/**
 * Valores comerciais W.Vetro permanecem independentes do preço unitário das
 * esquadrias. Não inferir o preço correto a partir do histórico divergente.
 */
export function moedaWVetro(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) && valor > 0 ? valor : null
  if (typeof valor !== 'string') return null
  let s = valor.trim().replace(/[^\d,.-]/g, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function valorOrigemVendaWVetro(fluxo: unknown): number | null {
  if (!fluxo || typeof fluxo !== 'object' || Array.isArray(fluxo)) return null
  const f = fluxo as Record<string, any>
  const p = f.payload_bruto && typeof f.payload_bruto === 'object' && !Array.isArray(f.payload_bruto)
    ? f.payload_bruto : {}
  return moedaWVetro(p.ValorTotal) ?? moedaWVetro(p.Total) ??
    moedaWVetro(p.ValorBruto) ?? moedaWVetro(p.Valor) ??
    moedaWVetro(f.valor_total_wvetro)
}

/** Exige centavos exatos e limite compatível com numeric(14,2). */
export function centavosVendaWVetro(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 999999999) return null
  const centavos = Math.round(v * 100)
  return Math.abs(v * 100 - centavos) < 0.000001 ? centavos : null
}
