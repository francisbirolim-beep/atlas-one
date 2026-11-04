export type DetalheFormaRecebimento = { forma: string; valor: number; parcelas?: number | null }

export const FORMAS_RECEBIMENTO = [
  { valor: 'pix', rotulo: 'PIX' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'cartao', rotulo: 'Cartão (legado)' },
  { valor: 'cartao_credito', rotulo: 'Cartão de crédito' },
  { valor: 'cartao_debito', rotulo: 'Cartão de débito' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'cheque', rotulo: 'Cheque' },
] as const

export function rotuloFormaRecebimento(forma?: string | null, parcelas?: number | null): string {
  if (forma === 'multiplo') return 'Múltiplas formas'
  const titulo=FORMAS_RECEBIMENTO.find(item => item.valor === forma)?.rotulo || forma || 'Não informada'
  return forma === 'cartao_credito' && parcelas ? `${titulo} · ${parcelas}x` : titulo
}

export function detalhamentoRecebimento(
  formas: DetalheFormaRecebimento[] | undefined,
  formaLegada: string | null | undefined,
  valor: number,
): DetalheFormaRecebimento[] {
  return formas?.length ? formas : formaLegada && formaLegada !== 'multiplo' ? [{ forma: formaLegada, valor }] : []
}
