// A medida original do orçamento é uma referência, nunca uma medição confirmada.
export function medidaInicialContramarco(real: number | null | undefined, prevista: number | null | undefined): string {
  if (real != null && Number.isFinite(Number(real)) && Number(real) > 0) return String(real)
  if (prevista != null && Number.isFinite(Number(prevista)) && Number(prevista) > 0) return String(prevista)
  return ''
}
