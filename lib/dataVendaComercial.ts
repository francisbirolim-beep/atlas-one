export type RegistroDataVenda = {
  data_venda?: string | null
  coluna_atualizada_em?: string | null
  created_at?: string | null
}

const formatadorBrasil = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit',
})

/** DATE é data de calendário (sem fuso); não converter YYYY-MM-DD com new Date(). */
export function dataVendaEfetivaYmd(card: RegistroDataVenda): string {
  if (card.data_venda && /^\d{4}-\d{2}-\d{2}$/.test(card.data_venda)) return card.data_venda
  const referencia = card.coluna_atualizada_em || card.created_at
  if (!referencia) return ''
  const d = new Date(referencia)
  if (Number.isNaN(d.getTime())) return ''
  const partes = formatadorBrasil.formatToParts(d)
  const get = (tipo: string) => partes.find(p => p.type === tipo)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function mesComercialAtual(): string {
  return dataVendaEfetivaYmd({ created_at: new Date().toISOString() }).slice(0, 7)
}

export function vendaPertenceAoMes(card: RegistroDataVenda, mes: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) &&
    dataVendaEfetivaYmd(card).startsWith(mes)
}
