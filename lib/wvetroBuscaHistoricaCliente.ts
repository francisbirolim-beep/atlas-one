/** Divide a pesquisa W.Vetro em janelas de até sete dias, sem repetir a semana atual. */
export function intervalosHistoricosClienteWVetro(dias: 90 | 365, hoje = new Date()): Array<{ inicio: string; fim: string }> {
  const umDia = 86_400_000
  const atual = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())
  const primeiro = atual - (dias - 1) * umDia
  let fim = atual - 7 * umDia
  const intervalos: Array<{ inicio: string; fim: string }> = []
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
  while (fim >= primeiro) {
    const inicio = Math.max(primeiro, fim - 6 * umDia)
    intervalos.push({ inicio: iso(inicio), fim: iso(fim) })
    fim = inicio - umDia
  }
  return intervalos
}