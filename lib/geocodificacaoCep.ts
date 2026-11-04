export type CepEnderecoViaCep = {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean | string
}

export function normalizarTextoEndereco(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizarRua(valor: string) {
  return normalizarTextoEndereco(valor).replace(/^(rua|avenida|av|travessa|alameda|praca|estrada|rodovia|r) /, '')
}

export function formatarCep(valor: string) {
  const digitos = valor.replace(/\D/g, '')
  return /^\d{8}$/.test(digitos) ? digitos.replace(/^(\d{5})(\d{3})$/, '$1-$2') : ''
}

function mesmaCidadeUf(item: CepEnderecoViaCep, cidade: string, uf: string) {
  return normalizarTextoEndereco(item.localidade || '') === normalizarTextoEndereco(cidade) &&
    normalizarTextoEndereco(item.uf || '') === normalizarTextoEndereco(uf)
}

export function cepCorrespondeAoEndereco(
  item: CepEnderecoViaCep | null,
  rua: string,
  cidade: string,
  uf: string,
) {
  if (!item || item.erro || !formatarCep(item.cep || '') || !rua || !cidade || !uf) return false
  // CEP genérico de cidade, sem logradouro, não identifica a rua onde está o GPS.
  return Boolean(item.logradouro) && normalizarRua(item.logradouro || '') === normalizarRua(rua) &&
    mesmaCidadeUf(item, cidade, uf)
}

/** Complementos seguros para pesquisa ViaCEP por UF/cidade/logradouro.
 * Quando existem CEPs diferentes na mesma rua, não escolhe nenhum automaticamente.
 */
export function selecionarComplementoViaCep(
  respostas: CepEnderecoViaCep[],
  rua: string,
  bairro: string,
  cidade: string,
  uf: string,
) {
  const candidatos = respostas.filter(item =>
    !item.erro && formatarCep(item.cep || '') && Boolean(item.logradouro) &&
    normalizarRua(item.logradouro || '') === normalizarRua(rua) &&
    mesmaCidadeUf(item, cidade, uf))
  const comBairro = bairro ? candidatos.filter(item =>
    normalizarTextoEndereco(item.bairro || '') === normalizarTextoEndereco(bairro)) : candidatos
  const selecionados = comBairro.length ? comBairro : candidatos
  const ceps = [...new Set(selecionados.map(item => formatarCep(item.cep || '')).filter(Boolean))]
  const bairros = [...new Set(selecionados.map(item => (item.bairro || '').trim()).filter(Boolean))]
  return {
    cep: ceps.length === 1 ? ceps[0] : '',
    bairro: bairros.length === 1 ? bairros[0] : '',
    correspondencias: selecionados.length,
    ambiguo: ceps.length > 1,
  }
}

export function selecionarCepViaCep(respostas: CepEnderecoViaCep[], rua: string, bairro: string, cidade: string, uf: string) {
  return selecionarComplementoViaCep(respostas, rua, bairro, cidade, uf).cep || null
}
