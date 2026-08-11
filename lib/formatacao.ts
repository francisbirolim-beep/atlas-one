export function formatarMoeda(valor: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor || 0))
}

export function formatarNumero(valor: number | null | undefined, casas = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Number(valor || 0))
}

export function formatarPercentual(valor: number | null | undefined, casas = 1): string {
  return `${formatarNumero(valor, casas)}%`
}

export function formatarData(valor: string | Date | null | undefined): string {
  if (!valor) return '-'
  const data = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(data.getTime())) return '-'
  return new Intl.DateTimeFormat('pt-BR').format(data)
}

export function formatarDataHora(valor: string | Date | null | undefined): string {
  if (!valor) return '-'
  const data = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(data.getTime())) return '-'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data)
}
