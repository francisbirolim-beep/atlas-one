// Só reutilizar o desenho de um cadastro existente quando ambos os códigos
// técnicos são idênticos. Similaridade de função, foto ou medidas não comprova
// que dois perfis de fabricantes distintos têm o mesmo desenho.
export function mesmaReferenciaCatalogo(codigoNovo: unknown, codigoExistente: unknown): boolean {
  const normalizar = (valor: unknown) =>
    String(valor ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const novo = normalizar(codigoNovo)
  const existente = normalizar(codigoExistente)
  return Boolean(novo) && novo === existente
}
