// Formata o endereço da obra sem interferir no cadastro do cliente.
// CEP fica dentro da coluna endereco já existente; não requer migration.
export function formatarEnderecoObra(rua: string, numero: string, cep: string): string {
  const partes = [rua.trim().replace(/\s+/g, ' '), numero.trim()].filter(Boolean)
  const soDigitos = cep.replace(/\D/g, '')
  const cepFormatado = soDigitos.length === 8
    ? soDigitos.slice(0, 5) + '-' + soDigitos.slice(5)
    : cep.trim()
  const endereco = partes.join(', ')
  return endereco && cepFormatado ? endereco + ' - CEP ' + cepFormatado : endereco
}

export function coordenadasDaObra(latitude: number, longitude: number): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return latitude.toFixed(6) + ',' + longitude.toFixed(6)
}
