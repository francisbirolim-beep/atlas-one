/** Valores em centavos: evita baixa indevida por arredondamento de ponto flutuante. */
export function centavosContaPagar(valor: unknown): number | null {
  if (typeof valor !== 'number' && typeof valor !== 'string') return null
  const texto = String(valor).trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(texto)) return null
  const n = Number(texto)
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000_000) return null
  return Math.round(n * 100)
}

export type CalculoBaixaPagar = {
  ok: boolean
  erro: string | null
  totalDevido: number
  valorEntregue: number
  valorLiquido: number
  valorDesconto: number
  valorJuros: number
  valorMulta: number
  valorTroco: number
  diferenca: number
}

export function calcularBaixaPagar(dados: {
  valorTitulo: unknown
  valorEntregue: unknown
  valorDesconto?: unknown
  valorJuros?: unknown
  valorMulta?: unknown
  valorTroco?: unknown
  formaPagamento?: string | null
}): CalculoBaixaPagar {
  const [titulo, entregue, desconto, juros, multa, troco] = [
    dados.valorTitulo,
    dados.valorEntregue,
    dados.valorDesconto ?? 0,
    dados.valorJuros ?? 0,
    dados.valorMulta ?? 0,
    dados.valorTroco ?? 0,
  ].map(centavosContaPagar)

  const invalido = (erro: string): CalculoBaixaPagar => ({
    ok: false, erro, totalDevido: 0, valorEntregue: 0, valorLiquido: 0,
    valorDesconto: 0, valorJuros: 0, valorMulta: 0, valorTroco: 0, diferenca: 0,
  })
  if ([titulo, entregue, desconto, juros, multa, troco].some(v => v === null)) {
    return invalido('Informe valores não negativos com até duas casas decimais.')
  }
  const [t, e, d, j, m, tr] = [titulo!, entregue!, desconto!, juros!, multa!, troco!]
  if (d > t) return invalido('O desconto não pode superar o valor original do título.')
  if (tr > e) return invalido('O troco não pode superar o valor entregue.')
  if (tr > 0 && dados.formaPagamento !== 'dinheiro') {
    return invalido('Troco só pode ser informado para pagamento em dinheiro.')
  }
  const total = t - d + j + m
  const liquido = e - tr
  const dif = liquido - total
  return {
    ok: dif === 0,
    erro: dif === 0 ? null : 'O valor líquido entregue deve ser igual ao total ajustado para quitar o título.',
    totalDevido: total / 100,
    valorEntregue: e / 100,
    valorLiquido: liquido / 100,
    valorDesconto: d / 100,
    valorJuros: j / 100,
    valorMulta: m / 100,
    valorTroco: tr / 100,
    diferenca: dif / 100,
  }
}

export function saldoContaPagar(conta: {
  valor: number | string
  valor_pago?: number | string | null
  valor_desconto?: number | string | null
  valor_juros?: number | string | null
  valor_multa?: number | string | null
  status?: string | null
}): number {
  const principal = Math.round(Number(conta.valor || 0) * 100)
  const desconto = Math.round(Number(conta.valor_desconto || 0) * 100)
  const juros = Math.round(Number(conta.valor_juros || 0) * 100)
  const multa = Math.round(Number(conta.valor_multa || 0) * 100)
  const pago = Math.round(Number(conta.valor_pago ?? (conta.status === 'pago' ? conta.valor : 0)) * 100)
  return Math.max(0, principal - desconto + juros + multa - pago) / 100
}
