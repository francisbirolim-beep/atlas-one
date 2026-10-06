export function normalizarNomeClienteWVetro(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function nomesClientesCompativeis(a: unknown, b: unknown) {
  const nomeA = normalizarNomeClienteWVetro(a)
  const nomeB = normalizarNomeClienteWVetro(b)
  if (!nomeA || !nomeB) return false
  if (nomeA === nomeB) return true

  const tokensA = nomeA.split(' ').filter(Boolean)
  const tokensB = nomeB.split(' ').filter(Boolean)
  const menor = tokensA.length <= tokensB.length ? tokensA : tokensB
  const maior = tokensA.length <= tokensB.length ? tokensB : tokensA

  // Nome muito curto não é suficiente para vínculo automático.
  if (menor.length < 2) return false
  if (menor[0] !== maior[0]) return false

  const conjuntoMaior = new Set(maior)
  return menor.every(token => conjuntoMaior.has(token))
}
