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
  road?: string
  pedestrian?: string
  residential?: string
  house_number?: string
}

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat')
  const lon = request.nextUrl.searchParams.get('lon')

  if (!lat || !lon || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 })
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', lat)
    url.searchParams.set('lon', lon)
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('accept-language', 'pt-BR')

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Atlas-One/1.0 (CRM de prospeccao em campo)',
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Não foi possível identificar o endereço.' }, { status: 502 })
    }

    const data = (await response.json()) as { address?: NominatimAddress }
    const address = data.address || {}

    return NextResponse.json({
      cidade: address.city || address.town || address.village || address.municipality || address.county || '',
      bairro: address.suburb || address.neighbourhood || address.quarter || '',
      rua: address.road || address.pedestrian || address.residential || '',
      numero: address.house_number || '',
    })
  } catch {
    return NextResponse.json({ error: 'Falha ao consultar o endereço da localização.' }, { status: 500 })
  }
}
