import { NextRequest, NextResponse } from 'next/server'
import {
  cepCorrespondeAoEndereco, formatarCep, selecionarComplementoViaCep,
  type CepEnderecoViaCep,
} from '@/lib/geocodificacaoCep'

export const dynamic = 'force-dynamic'

type NominatimAddress = {
  city?: string; town?: string; village?: string; municipality?: string; county?: string
  suburb?: string; neighbourhood?: string; quarter?: string; borough?: string
  city_district?: string; locality?: string; hamlet?: string
  road?: string; pedestrian?: string; residential?: string
  house_number?: string; postcode?: string; state?: string; country_code?: string
  'ISO3166-2-lvl4'?: string
}

const UFS: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA',
  ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES',
  goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT',
  'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA',
  paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
  'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
}

function obterUf(address: NominatimAddress) {
  const iso = address['ISO3166-2-lvl4'] || ''
  const ufIso = /^BR-([A-Z]{2})$/.exec(iso)?.[1]
  if (ufIso) return ufIso
  const nome = (address.state || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return UFS[nome] || ''
}

async function consultarCep(cep: string): Promise<CepEnderecoViaCep | null> {
  if (!formatarCep(cep)) return null
  try {
    const response = await fetch('https://viacep.com.br/ws/' + cep.replace(/\D/g, '') + '/json/', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4500),
      next: { revalidate: 3600 },
    })
    if (!response.ok) return null
    const data = await response.json() as CepEnderecoViaCep
    if (data.erro || !data.cep) return null
    return data
  } catch { return null }
}

async function pesquisarEndereco(uf: string, cidade: string, rua: string, bairro: string) {
  if (!uf || cidade.trim().length < 3 || rua.trim().length < 3) {
    return { cep: '', bairro: '', ambiguo: false }
  }
  try {
    const url = 'https://viacep.com.br/ws/' +
      [uf, cidade, rua].map(encodeURIComponent).join('/') + '/json/'
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5500),
      next: { revalidate: 3600 },
    })
    if (!response.ok) return { cep: '', bairro: '', ambiguo: false }
    const data: unknown = await response.json()
    if (!Array.isArray(data)) return { cep: '', bairro: '', ambiguo: false }
    return selecionarComplementoViaCep(data as CepEnderecoViaCep[], rua, bairro, cidade, uf)
  } catch { return { cep: '', bairro: '', ambiguo: false } }
}

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat')
  const lon = request.nextUrl.searchParams.get('lon')
  if (!lat || !lon || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon)) ||
      Number(lat) < -90 || Number(lat) > 90 || Number(lon) < -180 || Number(lon) > 180) {
    return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 })
  }
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', lat)
    url.searchParams.set('lon', lon)
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('zoom', '18')
    url.searchParams.set('accept-language', 'pt-BR')
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Atlas-One/1.0 (CRM de prospeccao em campo)',
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8500),
    })
    if (!response.ok) return NextResponse.json({ error: 'Não foi possível identificar o endereço.' }, { status: 502 })
    const data = await response.json() as { address?: NominatimAddress }
    const address = data.address || {}
    const cidade = address.city || address.town || address.village || address.municipality || address.county || ''
    let bairro = address.neighbourhood || address.quarter || address.suburb ||
      address.borough || address.city_district || address.locality || address.hamlet || ''
    const rua = address.road || address.pedestrian || address.residential || ''
    const cepMapa = formatarCep(address.postcode || '')
    const uf = obterUf(address)
    let cep = ''
    let cepOrigem: 'viacep-validado' | 'viacep-endereco' | null = null
    let cepAmbiguo = false

    if (address.country_code === 'br' && cidade && rua && uf) {
      const registroCep = cepMapa ? await consultarCep(cepMapa) : null
      if (cepCorrespondeAoEndereco(registroCep, rua, cidade, uf)) {
        cep = formatarCep(registroCep?.cep || '')
        cepOrigem = 'viacep-validado'
        if (registroCep?.bairro) bairro = registroCep.bairro
      } else {
        const encontrado = await pesquisarEndereco(uf, cidade, rua, bairro)
        // Em caso de CEPs múltiplos, não escolhe um CEP por aproximação de GPS.
        cep = encontrado.cep
        cepOrigem = cep ? 'viacep-endereco' : null
        cepAmbiguo = encontrado.ambiguo
        if (encontrado.bairro && (!bairro || cep)) bairro = encontrado.bairro
      }
    }

    return NextResponse.json({
      cidade, bairro, rua, uf, cep, cepOrigem, cepAmbiguo,
      cepPrecisaConferencia: Boolean(cep),
      cepAviso: cep ? 'CEP sugerido pela base postal. Confira o número do imóvel.' :
        cepAmbiguo ? 'Esta rua pode ter mais de um CEP. Confirme pelo número do imóvel.' :
          'CEP não confirmado. Digite o CEP conhecido e consulte a base postal.',
      // Nunca inferir o número a partir de um CEP ou do GPS.
      numero: address.house_number || '',
      numeroOrigem: address.house_number ? 'mapa' : null,
    })
  } catch {
    return NextResponse.json({ error: 'Falha ao consultar o endereço da localização.' }, { status: 500 })
  }
}
