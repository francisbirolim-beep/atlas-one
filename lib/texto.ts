export function normalizarBusca(valor: string | null | undefined): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function somenteDigitos(valor: string | null | undefined): string {
  return String(valor || '').replace(/\D/g, '')
}

export function textoMaiusculo(valor: string | null | undefined): string {
  return String(valor || '').trim().toLocaleUpperCase('pt-BR')
}

export function textoMaiusculoOuNull(valor: string | null | undefined): string | null {
  const texto = textoMaiusculo(valor)
  return texto || null
}

export function bateBusca(termo: string, ...valores: Array<string | number | null | undefined>): boolean {
  const alvo = normalizarBusca(termo)
  if (!alvo) return true
  const alvoNumerico = somenteDigitos(termo)

  return valores.some(valor => {
    const texto = String(valor ?? '')
    if (normalizarBusca(texto).includes(alvo)) return true
    if (alvoNumerico.length >= 3 && somenteDigitos(texto).includes(alvoNumerico)) return true
    return false
  })
}
