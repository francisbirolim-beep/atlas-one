// Máscara monetária pt-BR usada apenas nos campos de entrada do RH.
// O estado e as APIs continuam recebendo números, sem pontuação de exibição.
const formato = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatarNumeroMoedaBR(valor: number | null | undefined): string {
  return typeof valor === 'number' && Number.isFinite(valor) ? formato.format(valor) : ''
}

// Aceita strings previamente salvas, tanto "1000.38" como "1.000,38".
export function formatarTextoMonetarioBR(texto: string | null | undefined): string {
  const entrada = String(texto ?? '').trim()
  if (!entrada) return ''
  const numero = entrada.includes(',')
    ? Number(entrada.replace(/\./g, '').replace(',', '.'))
    : Number(entrada)
  return Number.isFinite(numero) ? formatarNumeroMoedaBR(numero) : ''
}

// Máscara de digitação da direita para a esquerda: 100038 -> 1.000,38.
// Remove automaticamente R$, espaços, pontos e vírgulas da digitação.
export function lerMoedaDigitada(texto: string): number {
  const digitos = texto.replace(/\D/g, '').slice(0, 15)
  return digitos ? Number(digitos) / 100 : 0
}

export function mascaraMoedaBR(texto: string): string {
  return /\d/.test(texto) ? formatarNumeroMoedaBR(lerMoedaDigitada(texto)) : ''
}
