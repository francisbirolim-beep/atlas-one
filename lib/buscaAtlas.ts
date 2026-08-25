export function normalizarBuscaAtlas(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

export function somenteNumerosAtlas(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '')
}

export function termosBuscaAtlas(consulta: string): string[] {
  const normalizada = normalizarBuscaAtlas(consulta)
  if (!normalizada) return []
  return [...new Set(normalizada.split(' ').map(t => t.trim()).filter(Boolean))]
}

/**
 * Padrão oficial de busca do Atlas.
 * - ignora maiúsculas/minúsculas e acentos;
 * - aceita várias palavras em qualquer ordem;
 * - cada termo pode estar em um campo diferente;
 * - números podem ser encontrados mesmo que CPF/CNPJ/telefone estejam formatados.
 */
export function correspondeBuscaAtlas(consulta: string, ...campos: unknown[]): boolean {
  const termos = termosBuscaAtlas(consulta)
  if (!termos.length) return true

  const texto = normalizarBuscaAtlas(campos.filter(v => v != null).join(' '))
  const numeros = somenteNumerosAtlas(campos.filter(v => v != null).join(' '))

  return termos.every(termo => {
    if (texto.includes(termo)) return true
    const digitos = somenteNumerosAtlas(termo)
    return digitos.length >= 2 && numeros.includes(digitos)
  })
}

export function valoresUnicosAtlas(valores: Array<string | null | undefined>): string[] {
  const mapa = new Map<string, string>()
  for (const valor of valores) {
    const original = String(valor ?? '').trim()
    if (!original) continue
    const chave = normalizarBuscaAtlas(original)
    if (!mapa.has(chave)) mapa.set(chave, original)
  }
  return Array.from(mapa.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function correspondeFiltroAtlas(valor: unknown, filtro: string): boolean {
  if (!filtro.trim()) return true
  return normalizarBuscaAtlas(valor) === normalizarBuscaAtlas(filtro)
}
