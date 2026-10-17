import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type NominatimAddress = {
  city?: string
  town?: string
  village?: string
  municipality?: string
  county?: string
  suburb?: string
  neighbourhood?: string
  quarter?: string
  borough?: string
  city_district?: string
  locality?: string
  hamlet?: string
  road?: string
  pedestrian?: string
  residential?: string
  house_number?: string
  postcode?: string
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
    url.searchParams.set('zoom', '18') // tenta a rua/ponto mais detalhado disponível no provedor
    url.searchParams.set('accept-language', 'pt-BR')

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Atlas-One/1.0 (CRM de prospeccao em campo)',
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8500),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Não foi possível identificar o endereço.' }, { status: 502 })
    }

    const data = (await response.json()) as { address?: NominatimAddress }
    const address = data.address || {}

    return NextResponse.json({
      cidade: address.city || address.town || address.village || address.municipality || address.county || '',
      bairro: address.neighbourhood || address.quarter || address.suburb ||
        address.borough || address.city_district || address.locality || address.hamlet || '',
      rua: address.road || address.pedestrian || address.residential || '',
      // Só retorna o número quando ele existir na base cartográfica; não calcula
      // faixa numérica artificial por latitude/longitude ou CEP.
      numero: address.house_number || '',
      numeroOrigem: address.house_number ? 'mapa' : null,
      cep: address.postcode || '',
    })
  } catch {
    return NextResponse.json({ error: 'Falha ao consultar o endereço da localização.' }, { status: 500 })
  }
}
