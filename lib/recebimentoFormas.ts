export type DetalheFormaRecebimento = { forma: string; valor: number; parcelas?: number | null }

export const FORMAS_RECEBIMENTO = [
  { valor: 'pix', rotulo: 'PIX' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'cartao', rotulo: 'Cartão' },
  { valor: 'cartao_credito', rotulo: 'Cartão de crédito' },
  { valor: 'cartao_debito', rotulo: 'Cartão de débito' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'cheque', rotulo: 'Cheque' },
] as const

export function rotuloFormaRecebimento(forma?: string | null): string {
  if (forma === 'multiplo') return 'Múltiplas formas'
  return FORMAS_RECEBIMENTO.find(item => item.valor === forma)?.rotulo || forma || 'Não informada'
}

export function detalhamentoRecebimento(
  formas: DetalheFormaRecebimento[] | undefined,
  formaLegada: string | null | undefined,
  valor: number,
): DetalheFormaRecebimento[] {
  return formas?.length ? formas : formaLegada && formaLegada !== 'multiplo' ? [{ forma: formaLegada, valor }] : []
}

export function descricaoFormaRecebimento(item: Pick<DetalheFormaRecebimento, 'forma' | 'parcelas'>): string {
  const rotulo = rotuloFormaRecebimento(item.forma)
  return item.forma === 'cartao_credito' && Number.isInteger(Number(item.parcelas)) && Number(item.parcelas) >= 1
    ? rotulo + ' · ' + item.parcelas + 'x'
    : rotulo
}
